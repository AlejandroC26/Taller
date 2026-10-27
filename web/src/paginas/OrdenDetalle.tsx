import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api/cliente';
import type { Orden, OrdenDetalle } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { EstadoOrden } from '../componentes/Etiqueta';
import { FichaOrden } from '../componentes/FichaOrden';
import { Aviso, Cargando, Ceja, Contorno, Encabezado } from '../componentes/Superficies';
import { cuenta, fecha, NOMBRE_ESTADO, pesos } from '../logica/formato';
import { puede } from '../logica/permisos';
import { usarAccion, usarDatos } from '../logica/usarDatos';
import { usarSesion } from '../sesion/sesion';
import { destinoDe } from './MisTrabajos';

const EN_COLA = ['agendada', 'remitida', 'aprobada'];

export function OrdenDetallePagina() {
  const { codigo = '' } = useParams();
  const { actor } = usarSesion();
  const navegar = useNavigate();
  const { datos: orden, error, cargando } = usarDatos<OrdenDetalle>(`/api/ordenes/${codigo}`);
  const accion = usarAccion();
  if (cargando && !orden) return <Cargando />;
  if (error || !orden || !actor) return <Aviso>{error ?? 'No existe la orden'}</Aviso>;

  const puedeTomar = puede.tomar(actor.rol) && EN_COLA.includes(orden.estado) && orden.sede.id === actor.tallerId;
  const tomar = async () => {
    const r = await accion.ejecutar(() => api<Orden>(`/api/ordenes/${codigo}/tomar`, { metodo: 'POST' }));
    if (r) navegar(destinoDe(r));
  };

  return (
    <>
      <Encabezado ceja={`Orden ${orden.codigo} · ${orden.sede.nombre}`} titulo={`${orden.vehiculo.placa} · ${orden.vehiculo.marca} ${orden.vehiculo.modelo}`}>
        <EstadoOrden estado={orden.estado} />
        {puedeTomar && (
          <Boton variante="primario" onClick={tomar} disabled={accion.ocupado}>
            {orden.estado === 'aprobada' ? 'Tomar reparación' : 'Tomar y diagnosticar'}
          </Boton>
        )}
      </Encabezado>
      {accion.error && <Aviso>{accion.error}</Aviso>}
      <p className="mb-24 text-body-sm text-texto-2">
        <strong className="font-semibold text-texto">Siguiente paso:</strong> {orden.siguiente_paso.descripcion}
      </p>

      <FichaOrden orden={orden} />

      <section className="mt-40 grid gap-16 md:grid-cols-2">
        <Contorno>
          <Ceja className="mb-12">Diagnóstico</Ceja>
          {orden.diagnostico ? (
            <>
              <p className="font-plus-jakarta-sans text-subheading font-bold text-titulo">{pesos(orden.diagnostico.total_mano_obra)}</p>
              <p className="text-body-sm text-texto-2">
                {cuenta(orden.diagnostico.servicios, 'servicio', 'servicios')} · {cuenta(orden.diagnostico.repuestos, 'repuesto por cotizar', 'repuestos por cotizar')} ·{' '}
                {orden.diagnostico.mecanico}
              </p>
              <Link to={`/ordenes/${orden.codigo}/diagnostico`} className="mt-12 inline-block text-body-sm font-semibold text-signal-blue hover:underline">
                Ver diagnóstico →
              </Link>
            </>
          ) : (
            <p className="text-body-sm text-texto-2">Empieza cuando un mecánico toma la orden.</p>
          )}
        </Contorno>
        <Contorno>
          <Ceja className="mb-12">Reparación</Ceja>
          {orden.reparacion ? (
            <>
              <p className="font-plus-jakarta-sans text-subheading font-bold text-titulo">
                {orden.reparacion.total_mano_obra !== null ? pesos(orden.reparacion.total_mano_obra) : 'En curso'}
              </p>
              <p className="text-body-sm text-texto-2">Inició {fecha(orden.reparacion.iniciada_en)}</p>
              <Link to={`/ordenes/${orden.codigo}/reparacion`} className="mt-12 inline-block text-body-sm font-semibold text-signal-blue hover:underline">
                Ver reparación →
              </Link>
            </>
          ) : (
            <p className="text-body-sm text-texto-2">Empieza cuando el cliente acepta la cotización.</p>
          )}
        </Contorno>
      </section>

      <section className="mt-40">
        <Ceja className="mb-16">Línea de tiempo</Ceja>
        <ol className="flex flex-col border-l border-borde">
          {orden.historial.map((p, i) => (
            <li key={i} className="relative pb-20 pl-24 last:pb-0">
              <span className="absolute top-6 -left-[5px] size-10 rounded-full bg-cloud dark:bg-carbon" />
              <p className="text-body-sm font-semibold">{NOMBRE_ESTADO[p.estado]}</p>
              <p className="text-[12px] text-texto-3">
                {fecha(p.fecha)} · {p.usuario}
              </p>
              {p.nota && <p className="text-body-sm text-texto-2">{p.nota}</p>}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
