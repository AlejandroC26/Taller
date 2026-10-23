import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api/cliente';
import type { Item, OrdenDetalle, Reparacion } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { aNumero, Entrada, Seleccion } from '../componentes/Campos';
import { EstadoOrden } from '../componentes/Etiqueta';
import { Aviso, Cargando, Ceja, Encabezado, Metrica, Tarjeta, Ventana } from '../componentes/Superficies';
import { Celda, Fila, Tabla } from '../componentes/Tabla';
import { aEntradaLocal, fecha, horas, pesos } from '../logica/formato';
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
    await ejecutar(() =>
      alGuardar({
        inicio: new Date(inicio).toISOString(),
        fin: new Date(fin).toISOString(),
        ...(tareaId ? { tareaId: Number(tareaId) } : {}),
        nota,
      }),
    );
  }

  return (
    <Tarjeta>
      <form onSubmit={enviar} className="grid gap-16 sm:grid-cols-2">
        <h2 className="text-heading sm:col-span-2">Registrar horas</h2>
        <Entrada etiqueta="Inicio" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
        <Entrada etiqueta="Fin" type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} required />
        <Seleccion etiqueta="Paso" value={tareaId} onChange={(e) => setTareaId(e.target.value)}>
          <option value="">General</option>
          {rep.tareas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.posicion}. {t.descripcion}
            </option>
          ))}
        </Seleccion>
        <Entrada etiqueta="Nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />
        <div className="flex items-center gap-16 sm:col-span-2">
          <Boton type="submit" variante="tinta" disabled={ocupado}>
            Registrar horas
          </Boton>
          {error && <Aviso>{error}</Aviso>}
        </div>
      </form>
    </Tarjeta>
  );
}

function FormularioParte({ items, alGuardar }: { items: Item[]; alGuardar: (cuerpo: object) => Promise<unknown> }) {
  const [itemId, setItemId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const { ocupado, error, ejecutar } = usarAccion();
  const item = items.find((i) => i.id === Number(itemId));

  return (
    <Tarjeta>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ejecutar(() => alGuardar({ itemId: Number(itemId), cantidad: aNumero(cantidad) })).then((r) => r !== undefined && setCantidad('1'));
        }}
        className="grid gap-16 sm:grid-cols-[2fr_1fr]"
      >
        <h2 className="text-heading sm:col-span-2">Parte usada</h2>
        <Seleccion etiqueta="Ítem" value={itemId} onChange={(e) => setItemId(e.target.value)} required>
          <option value="">Elija del inventario</option>
          {items.map((i) => (
            <option key={i.id} value={i.id} disabled={i.cantidad === 0}>
              {i.codigo} · {i.nombre} · {i.cantidad} disp.
            </option>
          ))}
        </Seleccion>
        <Entrada etiqueta="Cantidad" type="number" min={1} max={item?.cantidad} value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
        <div className="flex items-center gap-16 sm:col-span-2">
          <Boton type="submit" variante="tinta" disabled={ocupado || !itemId}>
            Descontar del inventario
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
  const { datos: items, recargar: recargarItems } = usarDatos<Item[]>('/api/inventario');
  const { ocupado, error, ejecutar } = usarAccion();

  if ((rep.cargando && !rep.datos) || (orden.cargando && !orden.datos)) return <Cargando />;
  if (rep.error || !rep.datos || !orden.datos || !actor) return <Aviso>{rep.error ?? orden.error ?? 'Sin reparación'}</Aviso>;

  const r = rep.datos;
  const asignado = orden.datos.asignaciones.some((a) => a.mecanicoId === actor.id && a.etapa === 'reparacion');
  const activa = r.estado === 'en_curso' && r.estadoOrden === 'en_reparacion';
  const trabaja = activa && puede.trabajar(actor.rol, asignado);
  const actualizar = async (accion: Promise<Reparacion>) => rep.setDatos(await accion);

  return (
    <>
      <Encabezado ceja={`Orden ${codigo} · ${orden.datos.vehiculo.placa} · inició ${fecha(r.iniciadaEn)}`} titulo="Reparación">
        <EstadoOrden estado={r.estadoOrden} />
        <Link to={`/ordenes/${codigo}`} className="flex h-36 items-center px-14 text-body-sm text-pale-stone hover:text-chalk">
          Volver a la orden
        </Link>
      </Encabezado>

      <div className="grid gap-40 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-w-0 flex-col gap-40">
          <section>
            <Ceja className="mb-16">Paso a paso</Ceja>
            <ul className="flex flex-col">
              {r.tareas.map((t) => (
                <li key={t.id} className="flex items-start gap-16 border-b border-carbon-lift py-12">
                  <input
                    type="checkbox"
                    aria-label={`Paso ${t.posicion} hecho`}
                    className="mt-4 size-16 accent-bone"
                    checked={t.completada}
                    disabled={!trabaja || ocupado}
                    onChange={(e) => ejecutar(() => actualizar(api(`${ruta}/tareas/${t.id}`, { metodo: 'PATCH', cuerpo: { completada: e.target.checked } })))}
                  />
                  <span className={`flex-1 ${t.completada ? 'text-warm-granite line-through' : ''}`}>
                    {t.posicion}. {t.descripcion}
                  </span>
                  <span className="mono text-warm-granite">
                    {horas(t.horasEstimadas)} · {pesos(t.valorServicio)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {trabaja && <FormularioHoras rep={r} alGuardar={(cuerpo) => actualizar(api(`${ruta}/horas`, { metodo: 'POST', cuerpo }))} />}
          <section>
            <Ceja className="mb-16">Horas registradas · {horas(r.real.horas)}</Ceja>
            <Tabla columnas={['Mecánico', 'Inicio', 'Fin', 'Horas', 'Nota']} vacia="Todavía no hay horas registradas">
              {r.horas.map((h) => (
                <Fila key={h.id}>
                  <Celda>{h.mecanico}</Celda>
                  <Celda>{fecha(h.inicio)}</Celda>
                  <Celda>{fecha(h.fin)}</Celda>
                  <Celda className="mono">{horas(h.horas)}</Celda>
                  <Celda className="text-warm-granite">{h.nota}</Celda>
                </Fila>
              ))}
            </Tabla>
          </section>

          {trabaja && (
            <FormularioParte
              items={items ?? []}
              alGuardar={async (cuerpo) => {
                await actualizar(api(`${ruta}/partes`, { metodo: 'POST', cuerpo }));
                recargarItems();
              }}
            />
          )}
          <section>
            <Ceja className="mb-16">Partes usadas</Ceja>
            <Tabla columnas={['Código', 'Parte', 'Cantidad', 'Precio', 'Subtotal']} vacia="Sin partes usadas">
              {r.partes.map((p) => (
                <Fila key={p.id}>
                  <Celda className="mono">{p.codigo}</Celda>
                  <Celda>{p.descripcion}</Celda>
                  <Celda>{p.cantidad}</Celda>
                  <Celda>{pesos(p.precioUnitario)}</Celda>
                  <Celda>{pesos(p.subtotal)}</Celda>
                </Fila>
              ))}
            </Tabla>
          </section>
        </div>

        <aside className="flex flex-col gap-24 lg:sticky lg:top-96 lg:self-start">
          <Ventana titulo="Liquidación">
            <div className="grid grid-cols-2">
              <Metrica etiqueta="Estimado" valor={pesos(r.estimado.total)} />
              <Metrica etiqueta="Real" valor={pesos(r.real.total)} />
            </div>
            <Metrica etiqueta={`Mano de obra · ${horas(r.real.horas)} × ${pesos(r.tarifaHora)}`} valor={pesos(r.real.manoObra)} />
            <Metrica etiqueta="Servicios realizados" valor={pesos(r.real.servicios)} />
            <Metrica etiqueta="Partes gastadas" valor={pesos(r.real.repuestos)} />
            <Metrica etiqueta="Diferencia con lo estimado" valor={`${r.diferencia > 0 ? '+' : ''}${pesos(r.diferencia)}`} />
          </Ventana>
          {trabaja && (
            <Boton
              variante="claro"
              disabled={ocupado || r.horas.length === 0}
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
          {trabaja && r.horas.length === 0 && <p className="text-caption text-warm-granite">Registre las horas antes de terminar.</p>}
          {error && <Aviso>{error}</Aviso>}
        </aside>
      </div>
    </>
  );
}
