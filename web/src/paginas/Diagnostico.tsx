import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api/cliente';
import type { Diagnostico, Item, OrdenDetalle, Tarea } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { aNumero, Area, Entrada, Seleccion } from '../componentes/Campos';
import { Etiqueta, EstadoOrden } from '../componentes/Etiqueta';
import { Aviso, Cargando, Ceja, Encabezado, Metrica, Tarjeta, Ventana } from '../componentes/Superficies';
import { costoEstimado } from '../logica/costos';
import { horas, pesos } from '../logica/formato';
import { puede } from '../logica/permisos';
import { usarAccion, usarDatos } from '../logica/usarDatos';
import { usarSesion } from '../sesion/sesion';

// En el formulario los números viven como texto, tal como se escriben.
interface RepuestoForm {
  clave: string;
  itemId: number | null;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
}
interface TareaForm {
  clave: string;
  descripcion: string;
  horasEstimadas: string;
  valorServicio: string;
  repuestos: RepuestoForm[];
}

let contador = 0;
const nuevaClave = () => `n${++contador}`;
const tareaVacia = (): TareaForm => ({ clave: nuevaClave(), descripcion: '', horasEstimadas: '1', valorServicio: '0', repuestos: [] });

export const aFormulario = (tareas: Tarea[]): TareaForm[] =>
  tareas.map((t) => ({
    clave: nuevaClave(),
    descripcion: t.descripcion,
    horasEstimadas: String(t.horasEstimadas),
    valorServicio: String(t.valorServicio),
    repuestos: t.repuestos.map((r) => ({
      clave: nuevaClave(),
      itemId: r.itemId,
      descripcion: r.descripcion,
      cantidad: String(r.cantidad),
      precioUnitario: String(r.precioUnitario),
    })),
  }));

// Lo que se envía a PUT /api/ordenes/:codigo/diagnostico.
export const aCuerpo = (tareas: TareaForm[]) =>
  tareas.map((t) => ({
    descripcion: t.descripcion.trim(),
    horasEstimadas: aNumero(t.horasEstimadas),
    valorServicio: aNumero(t.valorServicio),
    requierePiezas: t.repuestos.length > 0,
    repuestos: t.repuestos.map((r) =>
      r.itemId
        ? { itemId: r.itemId, cantidad: aNumero(r.cantidad) }
        : { descripcion: r.descripcion.trim(), cantidad: aNumero(r.cantidad), precioUnitario: aNumero(r.precioUnitario) },
    ),
  }));

export function EditorDiagnostico({
  inicial,
  items,
  tarifaEditable,
  alGuardar,
  alFinalizar,
}: {
  inicial: Diagnostico;
  items: Item[];
  tarifaEditable: boolean;
  alGuardar: (cuerpo: { observaciones: string; tarifaHora?: number; tareas: ReturnType<typeof aCuerpo> }) => Promise<unknown>;
  alFinalizar: () => Promise<unknown>;
}) {
  const [observaciones, setObservaciones] = useState(inicial.observaciones);
  const [tarifa, setTarifa] = useState(String(inicial.tarifaHora));
  const [tareas, setTareas] = useState<TareaForm[]>(() => (inicial.tareas.length ? aFormulario(inicial.tareas) : [tareaVacia()]));
  const [guardado, setGuardado] = useState(false);
  const { ocupado, error, ejecutar } = usarAccion();

  const precioDe = (r: RepuestoForm) => (r.itemId ? (items.find((i) => i.id === r.itemId)?.precio ?? 0) : aNumero(r.precioUnitario));
  const costo = useMemo(
    () =>
      costoEstimado(
        tareas.map((t) => ({
          horasEstimadas: aNumero(t.horasEstimadas),
          valorServicio: aNumero(t.valorServicio),
          repuestos: t.repuestos.map((r) => ({ cantidad: aNumero(r.cantidad), precioUnitario: precioDe(r) })),
        })),
        aNumero(tarifa),
      ),
    [tareas, tarifa, items],
  );

  const cambiarTarea = (clave: string, cambio: Partial<TareaForm>) => {
    setGuardado(false);
    setTareas((ts) => ts.map((t) => (t.clave === clave ? { ...t, ...cambio } : t)));
  };
  const cambiarRepuesto = (tarea: TareaForm, clave: string, cambio: Partial<RepuestoForm>) =>
    cambiarTarea(tarea.clave, { repuestos: tarea.repuestos.map((r) => (r.clave === clave ? { ...r, ...cambio } : r)) });
  const mover = (indice: number, hacia: -1 | 1) =>
    setTareas((ts) => {
      const copia = [...ts];
      const destino = indice + hacia;
      if (destino < 0 || destino >= copia.length) return ts;
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });

  const guardar = () =>
    ejecutar(async () => {
      await alGuardar({
        observaciones,
        ...(tarifaEditable ? { tarifaHora: aNumero(tarifa) } : {}),
        tareas: aCuerpo(tareas),
      });
      setGuardado(true);
    });

  return (
    <div className="grid gap-40 lg:grid-cols-[2fr_1fr]">
      <div className="flex min-w-0 flex-col gap-24">
        <Tarjeta className="grid gap-16 sm:grid-cols-[2fr_1fr]">
          <Area etiqueta="Observaciones generales" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Qué encontró al revisar el vehículo" />
          <Entrada
            etiqueta="Tarifa por hora"
            type="number"
            min={0}
            value={tarifa}
            disabled={!tarifaEditable}
            onChange={(e) => setTarifa(e.target.value)}
            ayuda={tarifaEditable ? 'Mano de obra en pesos' : 'La define recepción'}
          />
        </Tarjeta>

        <ol className="flex flex-col gap-24" aria-label="Paso a paso">
          {tareas.map((t, i) => (
            <li key={t.clave}>
              <Tarjeta className="flex flex-col gap-16">
                <div className="flex flex-wrap items-center justify-between gap-8">
                  <p className="mono">Paso {i + 1}</p>
                  <div className="flex gap-8">
                    <Boton variante="fantasma" sobre="claro" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir paso ${i + 1}`}>
                      ↑
                    </Boton>
                    <Boton variante="fantasma" sobre="claro" onClick={() => mover(i, 1)} disabled={i === tareas.length - 1} aria-label={`Bajar paso ${i + 1}`}>
                      ↓
                    </Boton>
                    <Boton variante="fantasma" sobre="claro" onClick={() => setTareas((ts) => ts.filter((x) => x.clave !== t.clave))} aria-label={`Quitar paso ${i + 1}`}>
                      Quitar
                    </Boton>
                  </div>
                </div>
                <Area etiqueta="Qué hacer" value={t.descripcion} onChange={(e) => cambiarTarea(t.clave, { descripcion: e.target.value })} rows={2} required />
                <div className="grid gap-16 sm:grid-cols-2">
                  <Entrada etiqueta="Horas estimadas" type="number" min={0} step={0.25} value={t.horasEstimadas} onChange={(e) => cambiarTarea(t.clave, { horasEstimadas: e.target.value })} />
                  <Entrada etiqueta="Valor del servicio" type="number" min={0} step={1000} value={t.valorServicio} onChange={(e) => cambiarTarea(t.clave, { valorServicio: e.target.value })} ayuda="Precio fijo, aparte de las horas" />
                </div>

                <div className="flex flex-col gap-16 border-t border-pale-stone pt-16">
                  <p className="mono text-graphite-mid">Repuestos {t.repuestos.length ? `(${t.repuestos.length})` : '· no requiere'}</p>
                  {t.repuestos.map((r) => {
                    const item = items.find((x) => x.id === r.itemId);
                    return (
                      <div key={r.clave} className="grid gap-16 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                        {r.itemId !== null ? (
                          <Seleccion etiqueta="Ítem del inventario" value={r.itemId} onChange={(e) => cambiarRepuesto(t, r.clave, { itemId: Number(e.target.value) })}>
                            {items.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.codigo} · {x.nombre} · {pesos(x.precio)} · {x.cantidad} disp.
                              </option>
                            ))}
                          </Seleccion>
                        ) : (
                          <div className="grid gap-16 sm:grid-cols-[2fr_1fr]">
                            <Entrada etiqueta="Pieza fuera de inventario" value={r.descripcion} onChange={(e) => cambiarRepuesto(t, r.clave, { descripcion: e.target.value })} required />
                            <Entrada etiqueta="Precio estimado" type="number" min={0} value={r.precioUnitario} onChange={(e) => cambiarRepuesto(t, r.clave, { precioUnitario: e.target.value })} />
                          </div>
                        )}
                        <Entrada
                          etiqueta="Cantidad"
                          type="number"
                          min={1}
                          value={r.cantidad}
                          onChange={(e) => cambiarRepuesto(t, r.clave, { cantidad: e.target.value })}
                          ayuda={item && item.cantidad < aNumero(r.cantidad) ? 'No alcanza: se pedirá' : undefined}
                        />
                        <Boton variante="fantasma" sobre="claro" onClick={() => cambiarTarea(t.clave, { repuestos: t.repuestos.filter((x) => x.clave !== r.clave) })}>
                          Quitar
                        </Boton>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-8">
                    <Boton
                      variante="fantasma"
                      sobre="claro"
                      disabled={items.length === 0}
                      onClick={() => cambiarTarea(t.clave, { repuestos: [...t.repuestos, { clave: nuevaClave(), itemId: items[0]?.id ?? null, descripcion: '', cantidad: '1', precioUnitario: '0' }] })}
                    >
                      + Del inventario
                    </Boton>
                    <Boton
                      variante="fantasma"
                      sobre="claro"
                      onClick={() => cambiarTarea(t.clave, { repuestos: [...t.repuestos, { clave: nuevaClave(), itemId: null, descripcion: '', cantidad: '1', precioUnitario: '0' }] })}
                    >
                      + Pieza que no hay
                    </Boton>
                  </div>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ol>
        <Boton variante="oscuro" onClick={() => setTareas((ts) => [...ts, tareaVacia()])}>
          + Agregar paso
        </Boton>
      </div>

      <aside className="flex flex-col gap-24 lg:sticky lg:top-96 lg:self-start">
        <Ventana titulo="Costo estimado">
          <Metrica etiqueta={`Mano de obra · ${horas(costo.horas)}`} valor={pesos(costo.manoObra)} />
          <Metrica etiqueta="Servicios" valor={pesos(costo.servicios)} />
          <Metrica etiqueta="Repuestos" valor={pesos(costo.repuestos)} />
          <Metrica etiqueta="Total" valor={<span data-testid="total">{pesos(costo.total)}</span>} />
        </Ventana>
        <Boton variante="claro" onClick={guardar} disabled={ocupado || tareas.length === 0}>
          {ocupado ? 'Guardando…' : 'Guardar borrador'}
        </Boton>
        <Boton
          variante="fantasma"
          disabled={ocupado || tareas.length === 0}
          onClick={() =>
            ejecutar(async () => {
              await alGuardar({ observaciones, ...(tarifaEditable ? { tarifaHora: aNumero(tarifa) } : {}), tareas: aCuerpo(tareas) });
              await alFinalizar();
            })
          }
        >
          Guardar y finalizar diagnóstico
        </Boton>
        {guardado && !error && <Aviso tipo="info">Borrador guardado.</Aviso>}
        {error && <Aviso>{error}</Aviso>}
      </aside>
    </div>
  );
}

function Lectura({ d }: { d: Diagnostico }) {
  return (
    <div className="grid gap-40 lg:grid-cols-[2fr_1fr]">
      <div className="flex min-w-0 flex-col gap-24">
        {d.observaciones && <p className="text-warm-granite">{d.observaciones}</p>}
        <ol className="flex flex-col">
          {d.tareas.map((t) => (
            <li key={t.id} className="border-b border-carbon-lift py-16">
              <div className="flex flex-wrap justify-between gap-8">
                <p>
                  <span className="mono mr-8 text-pale-stone">{t.posicion}</span>
                  {t.descripcion}
                </p>
                <p className="mono text-warm-granite">
                  {horas(t.horasEstimadas)} · {pesos(t.valorServicio)}
                </p>
              </div>
              {t.repuestos.length > 0 && (
                <ul className="mt-8 flex flex-col gap-8 pl-24 text-body-sm">
                  {t.repuestos.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-8">
                      <span>
                        {r.cantidad} × {r.descripcion} {r.codigo && <span className="text-warm-granite">({r.codigo})</span>}
                      </span>
                      <span className="flex items-center gap-16">
                        {pesos(r.cantidad * r.precioUnitario)}
                        <Etiqueta tono={r.disponible ? 'listo' : 'vivo'}>{r.disponible ? 'En stock' : 'Pedir'}</Etiqueta>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </div>
      <Ventana titulo="Costo estimado">
        <Metrica etiqueta={`Mano de obra · ${horas(d.costo.horas)}`} valor={pesos(d.costo.manoObra)} />
        <Metrica etiqueta="Servicios" valor={pesos(d.costo.servicios)} />
        <Metrica etiqueta="Repuestos" valor={pesos(d.costo.repuestos)} />
        <Metrica etiqueta="Total" valor={pesos(d.costo.total)} />
      </Ventana>
    </div>
  );
}

export function DiagnosticoPagina() {
  const { codigo = '' } = useParams();
  const { actor } = usarSesion();
  const ruta = `/api/ordenes/${codigo}/diagnostico`;
  const diag = usarDatos<Diagnostico>(ruta);
  const orden = usarDatos<OrdenDetalle>(`/api/ordenes/${codigo}`);
  const { datos: items } = usarDatos<Item[]>('/api/inventario');

  if ((diag.cargando && !diag.datos) || (orden.cargando && !orden.datos)) return <Cargando />;
  if (diag.error || !diag.datos || !orden.datos || !actor) return <Aviso>{diag.error ?? orden.error ?? 'Sin diagnóstico'}</Aviso>;

  const d = diag.datos;
  const asignado = orden.datos.asignaciones.some((a) => a.mecanicoId === actor.id && a.etapa === 'diagnostico');
  const editable = d.estado === 'borrador' && d.estadoOrden === 'en_diagnostico' && puede.trabajar(actor.rol, asignado);

  return (
    <>
      <Encabezado ceja={`Orden ${codigo} · ${orden.datos.vehiculo.placa} · ${d.mecanico}`} titulo="Diagnóstico">
        <EstadoOrden estado={d.estadoOrden} />
        <Link to={`/ordenes/${codigo}`} className="flex h-36 items-center px-14 text-body-sm text-pale-stone hover:text-chalk">
          Volver a la orden
        </Link>
      </Encabezado>
      <Ceja className="mb-24">Motivo: {orden.datos.motivo}</Ceja>
      {editable ? (
        <EditorDiagnostico
          inicial={d}
          items={items ?? []}
          tarifaEditable={puede.cambiarTarifa(actor.rol)}
          alGuardar={async (cuerpo) => diag.setDatos(await api<Diagnostico>(ruta, { metodo: 'PUT', cuerpo }))}
          alFinalizar={async () => {
            diag.setDatos(await api<Diagnostico>(`${ruta}/finalizar`, { metodo: 'POST' }));
            orden.recargar();
          }}
        />
      ) : (
        <Lectura d={d} />
      )}
    </>
  );
}
