import { Link } from 'react-router';
import type { Orden } from '../api/tipos';
import { EstadoOrden } from '../componentes/Etiqueta';
import { Aviso, Cargando, Contorno, Encabezado } from '../componentes/Superficies';
import { cuenta, fecha } from '../logica/formato';
import { usarDatos } from '../logica/usarDatos';

// Lo único que el mecánico necesita: los carros que tiene que arreglar y a dónde ir.
export function MisTrabajos() {
  const { datos, error, cargando } = usarDatos<Orden[]>('/api/ordenes?abiertas=1');
  if (cargando && !datos) return <Cargando />;

  const ordenes = datos ?? [];
  return (
    <>
      <Encabezado ceja={cuenta(ordenes.length, 'carro asignado', 'carros asignados')} titulo="Mis trabajos" />
      {error && <Aviso>{error}</Aviso>}
      {ordenes.length === 0 && !error && <p className="text-texto-2">No tiene carros asignados por ahora.</p>}
      <ul className="grid gap-24 md:grid-cols-2 lg:grid-cols-3">
        {ordenes.map((o) => (
          <li key={o.codigo}>
            <Contorno className="flex h-full flex-col gap-16">
              <div className="flex items-start justify-between gap-16">
                <span className="mono text-texto-3">{o.codigo}</span>
                <EstadoOrden estado={o.estado} />
              </div>
              <div>
                <p className="font-plus-jakarta-sans text-heading-sm font-bold text-titulo">{o.vehiculo.placa}</p>
                <p className="text-body-sm text-texto-2">
                  {o.vehiculo.marca} {o.vehiculo.modelo} {o.vehiculo.anio}
                </p>
              </div>
              <p className="line-clamp-3 text-body-sm">{o.motivo}</p>
              <p className="mono text-texto-2">Actualizada {fecha(o.actualizadoEn)}</p>
              <div className="mt-auto flex flex-wrap gap-16 border-t border-borde pt-16 text-body-sm">
                {(o.estado === 'en_diagnostico' || o.estado === 'diagnosticado') && (
                  <Link to={`/ordenes/${o.codigo}/diagnostico`} className="hover:underline">
                    Diagnóstico →
                  </Link>
                )}
                {(o.estado === 'en_reparacion' || o.estado === 'terminado') && (
                  <Link to={`/ordenes/${o.codigo}/reparacion`} className="hover:underline">
                    Reparación →
                  </Link>
                )}
                <Link to={`/ordenes/${o.codigo}`} className="text-texto-2 hover:underline">
                  Detalle
                </Link>
              </div>
            </Contorno>
          </li>
        ))}
      </ul>
    </>
  );
}
