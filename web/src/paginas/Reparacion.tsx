import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api/cliente';
import type { CodigoRepuesto, LineaCompra, OrdenDetalle, Reparacion } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { aNumero, Entrada, Seleccion } from '../componentes/Campos';
import { Etiqueta, EstadoOrden } from '../componentes/Etiqueta';
import { Aviso, Cargando, Ceja, Encabezado, Metrica, Tarjeta, Ventana } from '../componentes/Superficies';
import { Celda, Fila, Tabla } from '../componentes/Tabla';
import { aEntradaLocal, fecha, horas, NOMBRE_PAGADOR, numero, pesos } from '../logica/formato';
import { puede } from '../logica/permisos';
import { usarAccion, usarDatos } from '../logica/usarDatos';
import { usarSesion } from '../sesion/sesion';

function FormularioHoras({ rep, alGuardar }: { rep: Reparacion; alGuardar: (cuerpo: object) => Promise<unknown> }) {
  const ahora = new Date();
  const [inicio, setInicio] = useState(aEntradaLocal(new Date(ahora.getTime() - 3600_000)));
  const [fin, setFin] = useState(aEntradaLocal(ahora));
  const [tareaId, setTareaId] = useState('');
  const [nota, setNota] = useState('');
  const { ocupado, error, ejecutar } = usarAccion();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    await ejecutar(() => alGuardar({ inicio: new Date(inicio).toISOString(), fin: new Date(fin).toISOString(), ...(tareaId ? { tareaId: Number(tareaId) } : {}), nota }));
  }

  return (
    <Tarjeta>
      <form onSubmit={enviar} className="grid gap-16 sm:grid-cols-2">
        <h2 className="text-subheading sm:col-span-2">Registrar horas</h2>
        <p className="-mt-8 text-[12px] text-texto-2 sm:col-span-2">Son de control: la mano de obra se cobra por el precio del SKU.</p>
        <Entrada etiqueta="Inicio" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
        <Entrada etiqueta="Fin" type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} required />
        <Seleccion etiqueta="Servicio" value={tareaId} onChange={(e) => setTareaId(e.target.value)}>
          <option value="">General</option>
          {rep.servicios.filter((s) => !s.fija).map((s) => (
            <option key={s.id} value={s.id}>
              {s.sku} · {s.servicio}
            </option>
          ))}
        </Seleccion>
        <Entrada etiqueta="Nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />
        <div className="flex items-center gap-16 sm:col-span-2">
          <Boton type="submit" variante="primario" disabled={ocupado}>
            Registrar horas
          </Boton>
          {error && <Aviso>{error}</Aviso>}
        </div>
      </form>
    </Tarjeta>
  );
}

// Lo que se usó y gastó: código universal y cantidad (desde la compra o a mano).
export function FormularioParte({
  codigos,
  desde,
  alGuardar,
}: {
  codigos: CodigoRepuesto[];
  desde: LineaCompra | null;
  alGuardar: (cuerpo: object) => Promise<unknown>;
}) {
  const [codigo, setCodigo] = useState(desde?.codigo_repuesto ?? '');
  const [descripcion, setDescripcion] = useState(desde?.descripcion ?? '');
  const [cantidad, setCantidad] = useState(String(desde?.cantidad ?? 1));
  const [nota, setNota] = useState('');
  const { ocupado, error, ejecutar } = usarAccion();

  return (
    <Tarjeta>
      <form
        className="grid gap-16 sm:grid-cols-[1fr_2fr_90px]"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await ejecutar(() =>
            alGuardar({ codigoRepuesto: codigo.trim().toUpperCase(), ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}), cantidad: aNumero(cantidad), ...(desde ? { compraId: desde.id } : {}), nota }),
          );
          if (r !== undefined) {
            setCodigo('');
            setDescripcion('');
            setCantidad('1');
            setNota('');
          }
        }}
      >
        <h2 className="text-subheading sm:col-span-3">Parte usada</h2>
        <datalist id="codigos-usados">
          {codigos.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.descripcion}
            </option>
          ))}
        </datalist>
        <Entrada
          etiqueta="Código universal"
          list="codigos-usados"
          value={codigo}
          onChange={(e) => {
            const v = e.target.value.toUpperCase();
            setCodigo(v);
            setDescripcion(codigos.find((c) => c.codigo === v)?.descripcion ?? descripcion);
          }}
          required
        />
        <Entrada etiqueta="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <Entrada etiqueta="Cantidad" type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
        <div className="sm:col-span-3">
          <Entrada etiqueta="Nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder={desde ? `De la compra en ${desde.tienda}` : 'Opcional'} />
        </div>
        <div className="flex items-center gap-16 sm:col-span-3">
          <Boton type="submit" variante="primario" disabled={ocupado || !codigo.trim()}>
            Registrar parte usada
          </Boton>
          {error && <Aviso>{error}</Aviso>}
        </div>
      </form>
    </Tarjeta>
  );
}

export function ReparacionPagina() {
  const { codigo = '' } = useParams();
  const { actor } = usarSesion();
  const ruta = `/api/ordenes/${codigo}/reparacion`;
  const rep = usarDatos<Reparacion>(ruta);
  const orden = usarDatos<OrdenDetalle>(`/api/ordenes/${codigo}`);
  const { datos: codigos } = usarDatos<CodigoRepuesto[]>('/api/codigos-repuesto');
  const [desdeCompra, setDesdeCompra] = useState<LineaCompra | null>(null);
  const { ocupado, error, ejecutar } = usarAccion();

  if ((rep.cargando && !rep.datos) || (orden.cargando && !orden.datos)) return <Cargando />;
  if (rep.error || !rep.datos || !orden.datos || !actor) return <Aviso>{rep.error ?? orden.error ?? 'Sin reparación'}</Aviso>;

  const r = rep.datos;
  const asignado = orden.datos.asignaciones.some((a) => a.mecanico_id === actor.id && a.etapa === 'reparacion');
  const trabaja = r.estado === 'en_curso' && r.estado_orden === 'en_reparacion' && puede.trabajar(actor.rol, asignado);
  const actualizar = async (accion: Promise<Reparacion>) => rep.setDatos(await accion);
  const propios = r.servicios.filter((s) => !s.fija);

  return (
    <>
      <Encabezado ceja={`Orden ${codigo} · ${orden.datos.vehiculo.placa} · inició ${fecha(r.iniciada_en)}`} titulo="Reparación">
        <EstadoOrden estado={r.estado_orden} />
        <Link to={`/ordenes/${codigo}`} className="flex h-40 items-center px-12 text-body-sm text-texto-2 hover:underline">
          Ver orden
        </Link>
      </Encabezado>

      <div className="grid gap-40 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-w-0 flex-col gap-40">
          <section>
            <Ceja className="mb-12">Servicios aprobados</Ceja>
            <ul className="flex flex-col rounded-xl border border-borde">
              {r.servicios.map((s) => (
                <li key={s.id} className="flex items-start gap-12 border-b border-borde px-16 py-12 last:border-b-0">
                  <input
                    type="checkbox"
                    aria-label={`${s.servicio} hecho`}
                    className="mt-4 size-16 accent-signal-blue"
                    checked={s.completada}
                    disabled={!trabaja || ocupado || s.fija}
                    onChange={(e) => ejecutar(() => actualizar(api(`${ruta}/tareas/${s.id}`, { metodo: 'PATCH', cuerpo: { completada: e.target.checked } })))}
                  />
                  <span className={`flex-1 text-body-sm ${s.completada ? 'text-texto-2' : ''}`}>
                    <span className="mono mr-8 text-texto-3">{s.sku}</span>
                    {s.servicio}
                    {s.descripcion && <span className="block text-texto-2">{s.descripcion}</span>}
                  </span>
                  <span className="flex flex-col items-end gap-4 text-body-sm">
                    {pesos(s.precio)}
                    {s.garantia_valida && <Etiqueta tono="listo">Garantía</Etiqueta>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <Ceja className="mb-12">Orden de compra (facturación)</Ceja>
            <Tabla columnas={['Código', 'Repuesto', 'Cant.', 'Tienda', 'Precio', 'Paga', '']} vacia="Sin repuestos que comprar: solo mano de obra">
              {r.orden_compra.map((c) => (
                <Fila key={c.id}>
                  <Celda className="mono whitespace-nowrap">{c.codigo_repuesto}</Celda>
                  <Celda>{c.descripcion}</Celda>
                  <Celda>{c.cantidad}</Celda>
                  <Celda>{c.tienda}</Celda>
                  <Celda>{pesos(c.precio_unitario)}</Celda>
                  <Celda className="text-texto-2">{NOMBRE_PAGADOR[c.pagador]}</Celda>
                  <Celda>
                    {trabaja && (
                      <Boton variante="suave" onClick={() => setDesdeCompra(c)}>
                        Usada
                      </Boton>
                    )}
                  </Celda>
                </Fila>
              ))}
            </Tabla>
          </section>

          {trabaja && (
            <FormularioParte
              key={desdeCompra?.id ?? 'manual'}
              codigos={codigos ?? []}
              desde={desdeCompra}
              alGuardar={async (cuerpo) => {
                await actualizar(api(`${ruta}/partes`, { metodo: 'POST', cuerpo }));
                setDesdeCompra(null);
              }}
            />
          )}
          <section>
            <Ceja className="mb-12">Partes usadas</Ceja>
            <Tabla columnas={['Código', 'Parte', 'Cant.', 'Tienda', 'Nota']} vacia="Todavía no se registra ninguna parte usada">
              {r.partes_usadas.map((p) => (
                <Fila key={p.id}>
                  <Celda className="mono whitespace-nowrap">{p.codigo_repuesto}</Celda>
                  <Celda>{p.descripcion}</Celda>
                  <Celda>{p.cantidad}</Celda>
                  <Celda className="text-texto-2">{p.tienda ?? '—'}</Celda>
                  <Celda className="text-texto-2">{p.nota}</Celda>
                </Fila>
              ))}
            </Tabla>
          </section>

          {trabaja && <FormularioHoras rep={r} alGuardar={(cuerpo) => actualizar(api(`${ruta}/horas`, { metodo: 'POST', cuerpo }))} />}
          <section>
            <Ceja className="mb-12">Horas registradas · {horas(r.control.horas_reales)}</Ceja>
            <Tabla columnas={['Mecánico', 'Inicio', 'Fin', 'Horas', 'Nota']} vacia="Todavía no hay horas registradas">
              {r.horas.map((h) => (
                <Fila key={h.id}>
                  <Celda>{h.mecanico}</Celda>
                  <Celda>{fecha(h.inicio)}</Celda>
                  <Celda>{fecha(h.fin)}</Celda>
                  <Celda>{horas(h.horas)}</Celda>
                  <Celda className="text-texto-2">{h.nota}</Celda>
                </Fila>
              ))}
            </Tabla>
          </section>
        </div>

        <aside className="flex flex-col gap-20 lg:sticky lg:top-96 lg:self-start">
          <Ventana titulo="Mano de obra">
            <Metrica etiqueta="Realizada" valor={pesos(r.mano_obra_realizada)} detalle={`de ${pesos(r.mano_obra_cotizada)} cotizada`} />
            <Metrica
              etiqueta="Control de horas"
              valor={horas(r.control.horas_reales)}
              detalle={`${numero(r.control.horas_estandar)} h estándar${r.control.eficiencia !== null ? ` · eficiencia ${Math.round(r.control.eficiencia * 100)} %` : ''}`}
            />
          </Ventana>
          {trabaja && (
            <Boton
              variante="primario"
              disabled={ocupado || r.horas.length === 0 || !propios.some((s) => s.completada)}
              onClick={() =>
                ejecutar(async () => {
                  await actualizar(api(`${ruta}/terminar`, { metodo: 'POST' }));
                  orden.recargar();
                })
              }
            >
              Terminar reparación
            </Boton>
          )}
          {trabaja && (r.horas.length === 0 || !propios.some((s) => s.completada)) && (
            <p className="text-[12px] text-texto-2">Para terminar: registre las horas y marque los servicios hechos.</p>
          )}
          {r.estado_orden === 'pendiente_facturacion' && <Aviso tipo="info">Terminada: facturación envía el PSE al cliente.</Aviso>}
          {error && <Aviso>{error}</Aviso>}
        </aside>
      </div>
    </>
  );
}
