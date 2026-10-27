import { Link, useNavigate } from 'react-router';
import { api } from '../api/cliente';
import type { Orden } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { Etiqueta, EstadoOrden } from '../componentes/Etiqueta';
import { Aviso, Cargando, Ceja, Contorno, Encabezado } from '../componentes/Superficies';
import { cuenta, fecha, NOMBRE_ESPECIALIDAD } from '../logica/formato';
import { puede } from '../logica/permisos';
import { usarAccion, usarDatos } from '../logica/usarDatos';
import { usarSesion } from '../sesion/sesion';

// A dónde va el mecánico según el estado de la orden.
export function destinoDe(o: { codigo: string; estado: string }) {
  if (o.estado === 'en_diagnostico') return `/ordenes/${o.codigo}/diagnostico`;
  if (o.estado === 'en_reparacion') return `/ordenes/${o.codigo}/reparacion`;
  return `/ordenes/${o.codigo}`;
}

function Tarjeta({ o, alTomar, ocupado }: { o: Orden; alTomar?: () => void; ocupado?: boolean }) {
  return (
    <Contorno className="flex h-full flex-col gap-12">
      <div className="flex items-start justify-between gap-12">
        <span className="mono text-texto-3">{o.codigo}</span>
        <EstadoOrden estado={o.estado} />
      </div>
      <div>
        <p className="font-plus-jakarta-sans text-subheading font-bold text-titulo">{o.vehiculo.placa}</p>
        <p className="text-body-sm text-texto-2">
          {o.vehiculo.marca} {o.vehiculo.modelo} {o.vehiculo.anio} · {o.cliente.nombre}
        </p>
      </div>
      <div className="flex flex-wrap gap-8">
        {o.prediagnostico && <Etiqueta tono="neutro">{NOMBRE_ESPECIALIDAD[o.prediagnostico.especialidad]}</Etiqueta>}
        {o.por_garantia && <Etiqueta tono="revision">Por garantía</Etiqueta>}
        {o.remitida_desde && <Etiqueta tono="neutro">Remitida</Etiqueta>}
      </div>
      <p className="line-clamp-2 text-body-sm">{o.mensajes_cliente[0]?.texto ?? o.sintomas}</p>
      <p className="text-[12px] text-texto-3">
        {o.fecha_cita ? `Cita ${fecha(o.fecha_cita)} · ` : ''}
        {o.sede.nombre}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-12 border-t border-borde pt-12">
        {alTomar ? (
          <Boton variante="primario" onClick={alTomar} disabled={ocupado}>
            {o.estado === 'aprobada' ? 'Tomar reparación' : 'Tomar y diagnosticar'}
          </Boton>
        ) : (
          <Link to={destinoDe(o)} className="text-body-sm font-semibold text-signal-blue hover:underline">
            {o.estado === 'en_diagnostico' ? 'Diagnosticar →' : o.estado === 'en_reparacion' ? 'Reparar →' : 'Ver orden →'}
          </Link>
        )}
        <span className="text-[12px] text-texto-3">{o.siguiente_paso.descripcion}</span>
      </div>
    </Contorno>
  );
}

// El mecánico: sus órdenes y la cola de su sede (para tomar). El administrador: todas.
export function MisTrabajos() {
  const { actor } = usarSesion();
  const navegar = useNavigate();
  const esMecanico = actor ? puede.tomar(actor.rol) : false;
  const mias = usarDatos<Orden[]>(esMecanico ? '/api/ordenes?vista=mias' : '/api/ordenes?abiertas=1');
  const cola = usarDatos<Orden[]>(esMecanico ? '/api/ordenes?vista=cola' : null);
  const accion = usarAccion();

  async function tomar(o: Orden) {
    const r = await accion.ejecutar(() => api<Orden>(`/api/ordenes/${o.codigo}/tomar`, { metodo: 'POST' }));
    if (r) navegar(destinoDe(r));
  }

  if (mias.cargando && !mias.datos) return <Cargando />;
  const lista = mias.datos ?? [];
  return (
    <>
      <Encabezado ceja={esMecanico ? cuenta(lista.length, 'orden mía', 'órdenes mías') : 'Todas las sedes'} titulo={esMecanico ? 'Mis trabajos' : 'Órdenes abiertas'} />
      {(mias.error || accion.error) && <Aviso>{mias.error ?? accion.error}</Aviso>}

      {esMecanico && (
        <section className="mb-56">
          <Ceja className="mb-16">Cola de mi sede · {cuenta(cola.datos?.length ?? 0, 'esperando', 'esperando')}</Ceja>
          {cola.datos?.length === 0 && <p className="text-body-sm text-texto-2">No hay vehículos esperando mecánico en su sede.</p>}
          <ul className="grid gap-20 md:grid-cols-2 lg:grid-cols-3">
            {(cola.datos ?? []).map((o) => (
              <li key={o.codigo}>
                <Tarjeta o={o} alTomar={() => tomar(o)} ocupado={accion.ocupado} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        {esMecanico && <Ceja className="mb-16">Asignadas a mí</Ceja>}
        {lista.length === 0 && <p className="text-body-sm text-texto-2">{esMecanico ? 'No tiene órdenes asignadas: tome una de la cola.' : 'No hay órdenes abiertas.'}</p>}
        <ul className="grid gap-20 md:grid-cols-2 lg:grid-cols-3">
          {lista.map((o) => (
            <li key={o.codigo}>
              <Tarjeta o={o} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
