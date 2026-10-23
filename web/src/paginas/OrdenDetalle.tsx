import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api/cliente';
import type { Etapa, Mecanico, OrdenDetalle } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { Area, Seleccion } from '../componentes/Campos';
import { EstadoOrden } from '../componentes/Etiqueta';
import { Aviso, Cargando, Ceja, Contorno, Encabezado, Tarjeta } from '../componentes/Superficies';
import { fecha, NOMBRE_ESTADO, numero, pesos } from '../logica/formato';
import { puede } from '../logica/permisos';
import { usarAccion, usarDatos } from '../logica/usarDatos';
import { usarSesion } from '../sesion/sesion';

const CANCELABLES = ['recibido', 'en_diagnostico', 'diagnosticado', 'aprobado', 'en_reparacion'];

// Qué etapa se puede asignar según el estado de la orden.
export function etapaAsignable(estado: string): Etapa | null {
  if (estado === 'recibido' || estado === 'en_diagnostico') return 'diagnostico';
  if (estado === 'aprobado' || estado === 'en_reparacion') return 'reparacion';
  return null;
}

function Acciones({ orden, alCambiar }: { orden: OrdenDetalle; alCambiar: (o: OrdenDetalle) => void }) {
  const etapa = etapaAsignable(orden.estado);
  const { datos: mecanicos, recargar: recargarMecanicos } = usarDatos<Mecanico[]>(etapa ? '/api/mecanicos/disponibilidad' : null);
  const [mecanicoId, setMecanicoId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const { ocupado, error, ejecutar } = usarAccion();
  const ruta = `/api/ordenes/${orden.codigo}`;
  const hacer = async (accion: () => Promise<OrdenDetalle>) => {
    const r = await ejecutar(accion);
    if (r) alCambiar(r);
  };

  return (
    <Tarjeta className="flex flex-col gap-24">
      <h2 className="text-heading">Acciones</h2>
      {etapa && (
        <form
          className="flex flex-col gap-16"
          onSubmit={(e) => {
            e.preventDefault();
            void hacer(async () => {
              const r = await api<OrdenDetalle>(`${ruta}/asignaciones`, { metodo: 'POST', cuerpo: { mecanicoId, etapa } });
              // La carga del mecánico cambió: se limpia la elección y se vuelve a pedir.
              setMecanicoId('');
              recargarMecanicos();
              return r;
            });
          }}
        >
          <Seleccion etiqueta={`Asignar mecánico · ${etapa === 'diagnostico' ? 'diagnóstico' : 'reparación'}`} value={mecanicoId} onChange={(e) => setMecanicoId(e.target.value)} required>
            <option value="">Elija un mecánico</option>
            {(mecanicos ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} — {m.disponible ? 'disponible' : `${m.carga} en curso`}
              </option>
            ))}
          </Seleccion>
          <Boton type="submit" variante="tinta" disabled={ocupado || !mecanicoId}>
            Asignar
          </Boton>
        </form>
      )}
      {orden.estado === 'diagnosticado' && (
        <div className="flex flex-col gap-8">
          <p className="text-body-sm">
            Costo estimado: <strong className="font-medium">{pesos(orden.diagnostico?.costo.total)}</strong>
          </p>
          <Boton variante="tinta" disabled={ocupado} onClick={() => hacer(() => api(`${ruta}/estado`, { metodo: 'POST', cuerpo: { estado: 'aprobado', nota: 'El cliente aprobó el costo' } }))}>
            El cliente aprobó
          </Boton>
        </div>
      )}
      {orden.estado === 'terminado' && (
        <Boton variante="tinta" disabled={ocupado} onClick={() => hacer(() => api(`${ruta}/estado`, { metodo: 'POST', cuerpo: { estado: 'entregado' } }))}>
          Entregar al cliente
        </Boton>
      )}
      {CANCELABLES.includes(orden.estado) &&
        (cancelando ? (
          <form
            className="flex flex-col gap-16 border-t border-pale-stone pt-24"
            onSubmit={(e) => {
              e.preventDefault();
              void hacer(() => api(`${ruta}/cancelar`, { metodo: 'POST', cuerpo: { motivo } }));
            }}
          >
            <Area etiqueta="Motivo de la cancelación" value={motivo} onChange={(e) => setMotivo(e.target.value)} required minLength={5} />
            <p className="text-caption text-graphite-mid">
              Se cancela {orden.estado === 'en_reparacion' ? 'la reparación' : 'el diagnóstico'} en curso. No se puede deshacer.
            </p>
            <div className="flex gap-8">
              <Boton type="submit" variante="tinta" disabled={ocupado}>
                Confirmar cancelación
              </Boton>
              <Boton variante="fantasma" sobre="claro" onClick={() => setCancelando(false)}>
                Volver
              </Boton>
            </div>
          </form>
        ) : (
          <Boton variante="fantasma" sobre="claro" onClick={() => setCancelando(true)}>
            Cancelar {orden.estado === 'en_reparacion' ? 'reparación' : 'orden'}
          </Boton>
        ))}
      {!etapa && orden.estado !== 'diagnosticado' && orden.estado !== 'terminado' && !CANCELABLES.includes(orden.estado) && (
        <p className="text-body-sm text-graphite-mid">La orden está cerrada.</p>
      )}
      {error && <Aviso>{error}</Aviso>}
    </Tarjeta>
  );
}

export function OrdenDetallePagina() {
  const { codigo = '' } = useParams();
  const { actor } = usarSesion();
  const { datos: orden, setDatos, error, cargando } = usarDatos<OrdenDetalle>(`/api/ordenes/${codigo}`);
  if (cargando && !orden) return <Cargando />;
  if (error || !orden || !actor) return <Aviso>{error ?? 'No existe la orden'}</Aviso>;

  const gestiona = puede.gestionarOrdenes(actor.rol);
  return (
    <>
      <Encabezado ceja={`Orden ${orden.codigo} · ${orden.origen === 'concesionario' ? 'Concesionario' : 'Taller'}`} titulo={`${orden.vehiculo.placa} · ${orden.vehiculo.marca} ${orden.vehiculo.modelo}`}>
        <EstadoOrden estado={orden.estado} />
      </Encabezado>

      <div className="grid gap-40 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-w-0 flex-col gap-40">
          <section className="grid gap-24 sm:grid-cols-2">
            <div>
              <Ceja className="mb-8">Cliente</Ceja>
              <p>{orden.cliente.nombre}</p>
              <p className="text-body-sm text-warm-granite">
                {orden.cliente.documento} · {orden.cliente.telefono}
              </p>
            </div>
            <div>
              <Ceja className="mb-8">Vehículo</Ceja>
              <p>
                {orden.vehiculo.anio} · {orden.vehiculo.color || 'Sin color'}
              </p>
              <p className="text-body-sm text-warm-granite">{numero(orden.kilometraje ?? orden.vehiculo.kilometraje)} km</p>
            </div>
            <div className="sm:col-span-2">
              <Ceja className="mb-8">Motivo de ingreso</Ceja>
              <p>{orden.motivo}</p>
              {orden.motivoCancelacion && <p className="mt-8 text-body-sm text-warm-granite">Cancelada: {orden.motivoCancelacion}</p>}
            </div>
          </section>

          <section className="grid gap-24 md:grid-cols-2">
            <Contorno>
              <Ceja className="mb-16">Diagnóstico</Ceja>
              {orden.diagnostico ? (
                <>
                  <p className="text-heading">{pesos(orden.diagnostico.costo.total)}</p>
                  <p className="text-body-sm text-warm-granite">
                    {orden.diagnostico.tareas} pasos · {orden.diagnostico.mecanico} · {orden.diagnostico.estado}
                  </p>
                  <Link to={`/ordenes/${orden.codigo}/diagnostico`} className="mt-16 inline-block text-body-sm hover:text-chalk">
                    Ver diagnóstico →
                  </Link>
                </>
              ) : (
                <p className="text-body-sm text-warm-granite">Se abre al asignar un mecánico de diagnóstico.</p>
              )}
            </Contorno>
            <Contorno>
              <Ceja className="mb-16">Reparación</Ceja>
              {orden.reparacion ? (
                <>
                  <p className="text-heading">{orden.reparacion.total !== null ? pesos(orden.reparacion.total) : 'En curso'}</p>
                  <p className="text-body-sm text-warm-granite">Inició {fecha(orden.reparacion.iniciadaEn)}</p>
                  <Link to={`/ordenes/${orden.codigo}/reparacion`} className="mt-16 inline-block text-body-sm hover:text-chalk">
                    Ver reparación →
                  </Link>
                </>
              ) : (
                <p className="text-body-sm text-warm-granite">Se abre al aprobar y asignar la reparación.</p>
              )}
            </Contorno>
          </section>

          <section>
            <Ceja className="mb-16">Mecánicos asignados</Ceja>
            {orden.asignaciones.length === 0 ? (
              <p className="text-body-sm text-warm-granite">Sin asignar.</p>
            ) : (
              <ul className="flex flex-col">
                {orden.asignaciones.map((a) => (
                  <li key={a.id} className="flex justify-between border-b border-carbon-lift py-12 text-body-sm">
                    <span>{a.mecanico}</span>
                    <span className="mono text-warm-granite">{a.etapa === 'diagnostico' ? 'Diagnóstico' : 'Reparación'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <Ceja className="mb-16">Línea de tiempo</Ceja>
            <ol className="flex flex-col border-l border-ash-stroke">
              {orden.historial.map((p, i) => (
                <li key={i} className="relative pb-24 pl-24 last:pb-0">
                  <span className="absolute top-6 -left-[4px] size-8 rounded-full bg-graphite-mid" />
                  <p className="mono text-pale-stone">{NOMBRE_ESTADO[p.estado]}</p>
                  <p className="text-body-sm">
                    {fecha(p.fecha)} · {p.usuario}
                  </p>
                  {p.nota && <p className="text-body-sm text-warm-granite">{p.nota}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
        {gestiona && <Acciones orden={orden} alCambiar={setDatos} />}
      </div>
    </>
  );
}
