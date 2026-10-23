import { Link } from 'react-router';
import type { Orden } from '../api/tipos';
import { EstadoOrden } from '../componentes/Etiqueta';
import { Aviso, Cargando, Contorno, Encabezado } from '../componentes/Superficies';
import { fecha } from '../logica/formato';
import { usarDatos } from '../logica/usarDatos';

// Lo único que el mecánico necesita: los carros que tiene que arreglar y a dónde ir.
export function MisTrabajos() {
  const { datos, error, cargando } = usarDatos<Orden[]>('/api/ordenes?abiertas=1');
  if (cargando && !datos) return <Cargando />;

  const ordenes = datos ?? [];
  return (
    <>
      <Encabezado ceja={ordenes.length === 1 ? '1 carro asignado' : `${ordenes.length} carros asignados`} titulo="Mis trabajos" />
      {error && <Aviso>{error}</Aviso>}
      {ordenes.length === 0 && !error && <p className="text-warm-granite">No tiene carros asignados por ahora.</p>}
      <ul className="grid gap-24 md:grid-cols-2 lg:grid-cols-3">
        {ordenes.map((o) => (
          <li key={o.codigo}>
            <Contorno className="flex h-full flex-col gap-16">
              <div className="flex items-start justify-between gap-16">
                <span className="mono text-pale-stone">{o.codigo}</span>
                <EstadoOrden estado={o.estado} />
              </div>
              <div>
                <p className="text-heading">{o.vehiculo.placa}</p>
                <p className="text-body-sm text-warm-granite">
                  {o.vehiculo.marca} {o.vehiculo.modelo} {o.vehiculo.anio}
                </p>
              </div>
              <p className="line-clamp-3 text-body-sm">{o.motivo}</p>
              <p className="mono text-warm-granite">Actualizada {fecha(o.actualizadoEn)}</p>
              <div className="mt-auto flex flex-wrap gap-16 border-t border-carbon-lift pt-16 text-body-sm">
                {(o.estado === 'en_diagnostico' || o.estado === 'diagnosticado') && (
                  <Link to={`/ordenes/${o.codigo}/diagnostico`} className="hover:text-chalk">
                    Diagnóstico →
                  </Link>
                )}
                {(o.estado === 'en_reparacion' || o.estado === 'terminado') && (
                  <Link to={`/ordenes/${o.codigo}/reparacion`} className="hover:text-chalk">
                    Reparación →
                  </Link>
                )}
                <Link to={`/ordenes/${o.codigo}`} className="text-warm-granite hover:text-chalk">
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
