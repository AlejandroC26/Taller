import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { abrirArchivo, api, subirArchivo } from '../api/cliente';
import { CAUSAS } from '../api/tipos';
import type { Causa, CodigoRepuesto, Diagnostico, Evidencia, OrdenDetalle, Sede, Servicio, ServicioDiagnostico } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { aNumero, Area, Entrada, Seleccion } from '../componentes/Campos';
import { Etiqueta, EstadoOrden } from '../componentes/Etiqueta';
import { FichaOrden } from '../componentes/FichaOrden';
import { Aviso, Cargando, Ceja, Encabezado, Metrica, Tarjeta, Ventana } from '../componentes/Superficies';
import { totalManoObra } from '../logica/costos';
import { cuenta, dictamenSugerido, NOMBRE_CAUSA, NOMBRE_ESPECIALIDAD, NOMBRE_PAGADOR, pesos } from '../logica/formato';
import { puede } from '../logica/permisos';
import { usarAccion, usarDatos } from '../logica/usarDatos';
import { usarSesion } from '../sesion/sesion';

// En el formulario los números viven como texto, tal como se escriben.
export interface RepuestoForm {
  clave: string;
  codigo: string;
  descripcion: string;
  cantidad: string;
}
export interface ServicioForm {
  clave: string;
  id?: number;
  sku: string;
  descripcion: string;
  causa: Causa | '';
  aplica: boolean;
  motivo: string;
  repuestos: RepuestoForm[];
  evidencias: Evidencia[];
}

let contador = 0;
const nuevaClave = () => `n${++contador}`;
const servicioVacio = (): ServicioForm => ({ clave: nuevaClave(), sku: '', descripcion: '', causa: '', aplica: false, motivo: '', repuestos: [], evidencias: [] });

export const aFormulario = (servicios: ServicioDiagnostico[]): ServicioForm[] =>
  servicios
    .filter((s) => !s.fija)
    .map((s) => ({
      clave: nuevaClave(),
      id: s.id,
      sku: s.sku,
      descripcion: s.descripcion,
      causa: s.causa ?? '',
      aplica: s.garantia.aplica,
      motivo: s.garantia.motivo,
      repuestos: s.repuestos.map((r) => ({ clave: nuevaClave(), codigo: r.codigo_repuesto, descripcion: r.descripcion, cantidad: String(r.cantidad) })),
      evidencias: s.evidencias,
    }));

// Lo que se envía a PUT /api/ordenes/:codigo/diagnostico. Los repuestos van sin precio.
export const aCuerpo = (observaciones: string, servicios: ServicioForm[]) => ({
  observaciones,
  tareas: servicios.map((s) => ({
    ...(s.id ? { id: s.id } : {}),
    sku: s.sku,
    descripcion: s.descripcion.trim(),
    causa: s.causa || null,
    garantiaAplica: s.causa ? s.aplica : false,
    garantiaMotivo: s.motivo.trim(),
    repuestos: s.repuestos
      .filter((r) => r.codigo.trim())
      .map((r) => ({ codigoRepuesto: r.codigo.trim().toUpperCase(), ...(r.descripcion.trim() ? { descripcion: r.descripcion.trim() } : {}), cantidad: aNumero(r.cantidad) })),
  })),
});

function SubirEvidencia({ alSubir, deshabilitado, texto = 'Adjuntar foto o PDF' }: { alSubir: (archivo: File) => Promise<void>; deshabilitado?: boolean; texto?: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        capture="environment"
        hidden
        aria-label={texto}
        onChange={async (e) => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          if (!archivo) return;
          setOcupado(true);
          try {
            await alSubir(archivo);
          } finally {
            setOcupado(false);
          }
        }}
      />
      <Boton variante="azul" disabled={deshabilitado || ocupado} onClick={() => entrada.current?.click()}>
        {ocupado ? 'Subiendo…' : texto}
      </Boton>
    </>
  );
}

function ListaEvidencias({ evidencias }: { evidencias: Evidencia[] }) {
  if (!evidencias.length) return null;
  return (
    <ul className="flex flex-wrap gap-8">
      {evidencias.map((e) => (
        <li key={e.id}>
          <button type="button" className="cursor-pointer rounded-full bg-chip px-12 py-4 text-[12px] font-semibold text-texto hover:bg-sutil" onClick={() => abrirArchivo(`/api/evidencias/${e.id}`)}>
            📎 {e.nombre}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function EditorDiagnostico({
  inicial,
  catalogo,
  codigos,
  sedesRemision,
  alGuardar,
  alFinalizar,
  alRemitir,
  alSubir,
}: {
  inicial: Diagnostico;
  catalogo: Servicio[];
  codigos: CodigoRepuesto[];
  sedesRemision: Sede[];
  alGuardar: (cuerpo: ReturnType<typeof aCuerpo>) => Promise<Diagnostico>;
  alFinalizar: () => Promise<unknown>;
  alRemitir: (taller: number, nota: string) => Promise<unknown>;
  alSubir: (tareaId: number | null, archivo: File) => Promise<Evidencia>;
}) {
  const [observaciones, setObservaciones] = useState(inicial.observaciones);
  const [servicios, setServicios] = useState<ServicioForm[]>(() => {
    const f = aFormulario(inicial.servicios);
    return f.length ? f : [servicioVacio()];
  });
  const [evidenciasOrden, setEvidenciasOrden] = useState(inicial.evidencias_orden);
  const [guardado, setGuardado] = useState(false);
  const [remitiendo, setRemitiendo] = useState(false);
  const [sedeRemision, setSedeRemision] = useState('');
  const [nota, setNota] = useState('');
  const { ocupado, error, ejecutar } = usarAccion();
  const fijas = inicial.servicios.filter((s) => s.fija);
  const precioDe = (sku: string) => catalogo.find((c) => c.sku === sku)?.precio_mano_obra ?? 0;
  const total = totalManoObra([...fijas.map((f) => ({ precio: f.precio })), ...servicios.map((s) => ({ precio: precioDe(s.sku) }))]);
  const repuestos = servicios.reduce((s, x) => s + x.repuestos.filter((r) => r.codigo.trim()).length, 0);

  const cambiar = (clave: string, cambio: Partial<ServicioForm>) => {
    setGuardado(false);
    setServicios((ss) => ss.map((s) => (s.clave === clave ? { ...s, ...cambio } : s)));
  };
  const cambiarRepuesto = (s: ServicioForm, clave: string, cambio: Partial<RepuestoForm>) =>
    cambiar(s.clave, { repuestos: s.repuestos.map((r) => (r.clave === clave ? { ...r, ...cambio } : r)) });

  // Guarda y vuelve a armar el formulario con lo que respondió la API (así cada servicio
  // nuevo recibe su id y ya puede llevar evidencias).
  const guardar = () =>
    ejecutar(async () => {
      const d = await alGuardar(aCuerpo(observaciones, servicios));
      setServicios(aFormulario(d.servicios));
      setGuardado(true);
      return d;
    });

  const porCatalogo = useMemo(() => {
    const grupos = new Map<string, Servicio[]>();
    for (const s of catalogo) grupos.set(s.especialidad, [...(grupos.get(s.especialidad) ?? []), s]);
    return [...grupos.entries()];
  }, [catalogo]);

  return (
    <div className="grid gap-40 lg:grid-cols-[2fr_1fr]">
      <div className="flex min-w-0 flex-col gap-20">
        <datalist id="codigos-repuesto">
          {codigos.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.descripcion}
            </option>
          ))}
        </datalist>
        <Tarjeta>
          <Area etiqueta="Observaciones generales" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Qué encontró al revisar el vehículo" />
        </Tarjeta>

        {fijas.map((f) => (
          <Tarjeta key={f.id} className="flex flex-wrap items-center justify-between gap-12">
            <div>
              <p className="font-semibold">{f.servicio}</p>
              <p className="text-body-sm text-texto-2">{f.descripcion}</p>
            </div>
            <Etiqueta tono="listo">Hecha · {pesos(f.precio)}</Etiqueta>
          </Tarjeta>
        ))}

        <ol className="flex flex-col gap-20" aria-label="Servicios">
          {servicios.map((s, i) => {
            const servicio = catalogo.find((c) => c.sku === s.sku);
            return (
              <li key={s.clave}>
                <Tarjeta className="flex flex-col gap-16">
                  <div className="flex flex-wrap items-center justify-between gap-8">
                    <p className="mono text-texto-3">Servicio {i + 1}</p>
                    <Boton variante="suave" onClick={() => setServicios((ss) => ss.filter((x) => x.clave !== s.clave))} aria-label={`Quitar servicio ${i + 1}`}>
                      Quitar
                    </Boton>
                  </div>
                  <Seleccion etiqueta="Servicio (SKU)" value={s.sku} onChange={(e) => cambiar(s.clave, { sku: e.target.value })} ayuda={servicio ? `Mano de obra ${pesos(servicio.precio_mano_obra)} · ${servicio.horas_estandar} h estándar` : undefined}>
                    <option value="">Elija un servicio</option>
                    {porCatalogo.map(([especialidad, lista]) => (
                      <optgroup key={especialidad} label={NOMBRE_ESPECIALIDAD[especialidad as keyof typeof NOMBRE_ESPECIALIDAD]}>
                        {lista.map((c) => (
                          <option key={c.sku} value={c.sku}>
                            {c.sku} · {c.nombre} · {pesos(c.precio_mano_obra)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Seleccion>
                  <Area etiqueta="Qué encontró y qué va a hacer" value={s.descripcion} onChange={(e) => cambiar(s.clave, { descripcion: e.target.value })} rows={2} />

                  <div className="grid gap-16 rounded-xl border border-borde bg-lienzo p-16 sm:grid-cols-2">
                    <Seleccion
                      etiqueta="Causa de la falla"
                      value={s.causa}
                      onChange={(e) => {
                        const causa = e.target.value as Causa | '';
                        cambiar(s.clave, { causa, aplica: dictamenSugerido(causa || null) });
                      }}
                    >
                      <option value="">Sin falla atribuible (mantenimiento)</option>
                      {CAUSAS.map((c) => (
                        <option key={c} value={c}>
                          {NOMBRE_CAUSA[c]}
                        </option>
                      ))}
                    </Seleccion>
                    <fieldset className="flex flex-col gap-8" disabled={!s.causa}>
                      <legend className="mb-8 text-body-sm font-medium">¿Aplica garantía?</legend>
                      <div className="flex gap-8">
                        {[true, false].map((v) => (
                          <label key={String(v)} className={`flex h-40 flex-1 cursor-pointer items-center justify-center rounded-full border text-body-sm font-semibold ${s.aplica === v && s.causa ? 'border-accion bg-accion text-accion-texto' : 'border-borde'} ${!s.causa ? 'opacity-40' : ''}`}>
                            <input type="radio" className="sr-only" name={`aplica-${s.clave}`} checked={s.aplica === v} onChange={() => cambiar(s.clave, { aplica: v })} />
                            {v ? 'Sí aplica' : 'No aplica'}
                          </label>
                        ))}
                      </div>
                      {s.causa && s.aplica !== dictamenSugerido(s.causa) && <p className="text-[12px] text-texto-2">Cambió el dictamen sugerido: explique por qué.</p>}
                    </fieldset>
                    {s.causa && (
                      <div className="sm:col-span-2">
                        <Area
                          etiqueta="Motivo del dictamen"
                          value={s.motivo}
                          onChange={(e) => cambiar(s.clave, { motivo: e.target.value })}
                          rows={2}
                          placeholder="Lo que verá el concesionario y el cliente"
                          ayuda={!s.motivo.trim() ? 'Obligatorio para finalizar' : undefined}
                        />
                      </div>
                    )}
                    {s.causa && (
                      <div className="flex flex-col gap-8 sm:col-span-2">
                        <ListaEvidencias evidencias={s.evidencias} />
                        <div className="flex flex-wrap items-center gap-12">
                          <SubirEvidencia
                            deshabilitado={!s.id}
                            alSubir={async (archivo) => {
                              const ev = await ejecutar(() => alSubir(s.id!, archivo));
                              if (ev) cambiar(s.clave, { evidencias: [...s.evidencias, ev] });
                            }}
                          />
                          <span className="text-[12px] text-texto-2">
                            {!s.id ? 'Guarde el borrador para adjuntar evidencias' : s.aplica && !s.evidencias.length ? 'Si aplica garantía, la evidencia es obligatoria' : ''}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-12">
                    <p className="text-body-sm font-medium">
                      Repuestos a comprar {s.repuestos.length ? `(${s.repuestos.length})` : <span className="text-texto-3">· ninguno</span>}
                    </p>
                    {s.repuestos.map((r) => (
                      <div key={r.clave} className="grid gap-12 sm:grid-cols-[minmax(150px,1fr)_2fr_80px_auto] sm:items-end">
                        <Entrada
                          etiqueta="Código universal"
                          list="codigos-repuesto"
                          value={r.codigo}
                          onChange={(e) => {
                            const codigo = e.target.value.toUpperCase();
                            cambiarRepuesto(s, r.clave, { codigo, descripcion: codigos.find((c) => c.codigo === codigo)?.descripcion ?? r.descripcion });
                          }}
                          placeholder="PAS-DEL-CER"
                        />
                        <Entrada etiqueta="Descripción" value={r.descripcion} onChange={(e) => cambiarRepuesto(s, r.clave, { descripcion: e.target.value })} />
                        <Entrada etiqueta="Cantidad" type="number" min={1} value={r.cantidad} onChange={(e) => cambiarRepuesto(s, r.clave, { cantidad: e.target.value })} />
                        <Boton variante="suave" onClick={() => cambiar(s.clave, { repuestos: s.repuestos.filter((x) => x.clave !== r.clave) })}>
                          Quitar
                        </Boton>
                      </div>
                    ))}
                    <div>
                      <Boton variante="suave" onClick={() => cambiar(s.clave, { repuestos: [...s.repuestos, { clave: nuevaClave(), codigo: '', descripcion: '', cantidad: '1' }] })}>
                        + Repuesto
                      </Boton>
                    </div>
                  </div>
                </Tarjeta>
              </li>
            );
          })}
        </ol>
        <Boton onClick={() => setServicios((ss) => [...ss, servicioVacio()])}>+ Agregar servicio</Boton>

        {inicial.por_garantia && (
          <Tarjeta className="flex flex-col gap-12">
            <p className="font-semibold">Evidencias del reclamo de garantía</p>
            <p className="text-body-sm text-texto-2">La orden vino por garantía: adjunte al menos una evidencia que respalde su dictamen, aplique o no.</p>
            <ListaEvidencias evidencias={evidenciasOrden} />
            <div>
              <SubirEvidencia
                texto="Adjuntar evidencia de la orden"
                alSubir={async (archivo) => {
                  const ev = await ejecutar(() => alSubir(null, archivo));
                  if (ev) setEvidenciasOrden((e) => [...e, ev]);
                }}
              />
            </div>
          </Tarjeta>
        )}
      </div>

      <aside className="flex flex-col gap-20 lg:sticky lg:top-96 lg:self-start">
        <Ventana titulo="Para facturación">
          <Metrica etiqueta="Mano de obra (SKU)" valor={<span data-testid="total">{pesos(total)}</span>} />
          <Metrica etiqueta="Repuestos" valor={cuenta(repuestos, 'por cotizar', 'por cotizar')} detalle="Facturación busca los precios en las tiendas" />
        </Ventana>
        <Boton variante="primario" onClick={guardar} disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar borrador'}
        </Boton>
        <Boton
          disabled={ocupado || servicios.length === 0}
          onClick={() =>
            ejecutar(async () => {
              await alGuardar(aCuerpo(observaciones, servicios));
              await alFinalizar();
            })
          }
        >
          Finalizar y enviar a garantía
        </Boton>
        {sedesRemision.length > 0 &&
          (remitiendo ? (
            <Tarjeta className="flex flex-col gap-12">
              <p className="font-semibold">Remitir a sede especializada</p>
              <Seleccion etiqueta="Sede" value={sedeRemision} onChange={(e) => setSedeRemision(e.target.value)}>
                <option value="">Elija la sede</option>
                {sedesRemision.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} · {s.especialidades.map((e) => NOMBRE_ESPECIALIDAD[e]).join(', ')}
                  </option>
                ))}
              </Seleccion>
              <Area etiqueta="Nota para el especialista" value={nota} onChange={(e) => setNota(e.target.value)} rows={3} placeholder="Qué encontró en la revisión general" />
              <p className="text-[12px] text-texto-2">La revisión general queda cobrada junto con lo que haga el especialista.</p>
              <div className="flex gap-8">
                <Boton variante="primario" disabled={ocupado || !sedeRemision || nota.trim().length < 5} onClick={() => ejecutar(() => alRemitir(Number(sedeRemision), nota.trim()))}>
                  Remitir
                </Boton>
                <Boton onClick={() => setRemitiendo(false)}>Volver</Boton>
              </div>
            </Tarjeta>
          ) : (
            <Boton variante="azul" onClick={() => setRemitiendo(true)}>
              Remitir a sede especializada
            </Boton>
          ))}
        {guardado && !error && <Aviso tipo="info">Borrador guardado.</Aviso>}
        {error && <Aviso>{error}</Aviso>}
      </aside>
    </div>
  );
}

function Lectura({ d }: { d: Diagnostico }) {
  return (
    <div className="grid gap-40 lg:grid-cols-[2fr_1fr]">
      <div className="flex min-w-0 flex-col gap-16">
        {d.observaciones && <p className="text-texto-2">{d.observaciones}</p>}
        {d.servicios.map((s) => (
          <Tarjeta key={s.id} className="flex flex-col gap-12">
            <div className="flex flex-wrap items-start justify-between gap-8">
              <div>
                <p className="font-semibold">
                  <span className="mono mr-8 text-texto-3">{s.sku}</span>
                  {s.servicio}
                </p>
                {s.descripcion && <p className="text-body-sm text-texto-2">{s.descripcion}</p>}
              </div>
              <span className="font-plus-jakarta-sans font-bold">{pesos(s.precio)}</span>
            </div>
            {s.causa && (
              <div className="flex flex-col gap-8 rounded-xl border border-borde bg-lienzo p-12 text-body-sm">
                <p>
                  <strong className="font-semibold">{s.causa_nombre}</strong> · dictamen del mecánico: {s.garantia.aplica ? 'aplica garantía' : 'no aplica'} — {s.garantia.motivo}
                </p>
                {s.garantia.valida !== null && (
                  <p className="flex flex-wrap items-center gap-8">
                    <Etiqueta tono={s.garantia.valida ? 'listo' : 'alerta'}>{s.garantia.valida ? 'Garantía válida' : 'Garantía no válida'}</Etiqueta>
                    <span>{s.garantia.respuesta}</span>
                    <span className="text-texto-3">Paga: {NOMBRE_PAGADOR[s.garantia.pagador]}</span>
                  </p>
                )}
                <ListaEvidencias evidencias={s.evidencias} />
              </div>
            )}
            {s.repuestos.length > 0 && (
              <ul className="text-body-sm">
                {s.repuestos.map((r) => (
                  <li key={r.id}>
                    {r.cantidad} × {r.descripcion} <span className="mono text-texto-3">{r.codigo_repuesto}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        ))}
        {d.evidencias_orden.length > 0 && (
          <div>
            <Ceja className="mb-8">Evidencias de la orden</Ceja>
            <ListaEvidencias evidencias={d.evidencias_orden} />
          </div>
        )}
      </div>
      <Ventana titulo="Para facturación">
        <Metrica etiqueta="Mano de obra (SKU)" valor={pesos(d.total_mano_obra)} />
        <Metrica etiqueta="Repuestos" valor={cuenta(d.repuestos_a_comprar, 'por cotizar', 'por cotizar')} />
      </Ventana>
    </div>
  );
}

export function DiagnosticoPagina() {
  const { codigo = '' } = useParams();
  const { actor } = usarSesion();
  const navegar = useNavigate();
  const ruta = `/api/ordenes/${codigo}/diagnostico`;
  const diag = usarDatos<Diagnostico>(ruta);
  const orden = usarDatos<OrdenDetalle>(`/api/ordenes/${codigo}`);
  const { datos: catalogo } = usarDatos<Servicio[]>('/api/servicios');
  const { datos: codigos } = usarDatos<CodigoRepuesto[]>('/api/codigos-repuesto');
  const { datos: sedes } = usarDatos<Sede[]>('/api/talleres');

  if ((diag.cargando && !diag.datos) || (orden.cargando && !orden.datos)) return <Cargando />;
  if (diag.error || !diag.datos || !orden.datos || !actor) return <Aviso>{diag.error ?? orden.error ?? 'Sin diagnóstico'}</Aviso>;

  const d = diag.datos;
  const o = orden.datos;
  const asignado = o.asignaciones.some((a) => a.mecanico_id === actor.id && a.etapa === 'diagnostico');
  const editable = d.estado === 'borrador' && d.estado_orden === 'en_diagnostico' && puede.trabajar(actor.rol, asignado);
  const sedesRemision = o.sede.tipo === 'mantenimiento' ? (sedes ?? []).filter((s) => s.activo && s.tipo === 'especializado' && s.id !== o.sede.id) : [];

  return (
    <>
      <Encabezado ceja={`Orden ${codigo} · ${o.sede.nombre}`} titulo="Diagnóstico">
        <EstadoOrden estado={d.estado_orden} />
        <Link to={`/ordenes/${codigo}`} className="flex h-40 items-center px-12 text-body-sm text-texto-2 hover:underline">
          Ver orden
        </Link>
      </Encabezado>
      <div className="mb-40">
        <FichaOrden orden={o} />
      </div>
      {editable ? (
        <EditorDiagnostico
          inicial={d}
          catalogo={catalogo ?? []}
          codigos={codigos ?? []}
          sedesRemision={sedesRemision}
          alGuardar={async (cuerpo) => {
            const r = await api<Diagnostico>(ruta, { metodo: 'PUT', cuerpo });
            diag.setDatos(r);
            return r;
          }}
          alFinalizar={async () => {
            diag.setDatos(await api<Diagnostico>(`${ruta}/finalizar`, { metodo: 'POST' }));
            orden.recargar();
          }}
          alRemitir={async (taller, nota) => {
            await api(`/api/ordenes/${codigo}/remitir`, { metodo: 'POST', cuerpo: { taller, nota } });
            navegar('/mis-trabajos');
          }}
          alSubir={(tareaId, archivo) => {
            const formulario = new FormData();
            formulario.append('archivo', archivo);
            if (tareaId) formulario.append('tareaId', String(tareaId));
            return subirArchivo<Evidencia>(`/api/ordenes/${codigo}/evidencias`, formulario);
          }}
        />
      ) : (
        <Lectura d={d} />
      )}
    </>
  );
}
