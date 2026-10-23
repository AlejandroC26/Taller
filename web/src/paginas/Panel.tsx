import { Link, useNavigate } from 'react-router';
import type { Panel } from '../api/tipos';
import { Avatar, GrupoAvatares } from '../componentes/Avatar';
import { Etiqueta, EstadoOrden } from '../componentes/Etiqueta';
import { Aviso, Cargando, Ceja, Encabezado, Metrica, Ventana } from '../componentes/Superficies';
import { Celda, Fila, Tabla } from '../componentes/Tabla';
import { cuenta, fecha, pesos } from '../logica/formato';
import { usarDatos } from '../logica/usarDatos';

export function PanelPagina() {
  const { datos, error, cargando } = usarDatos<Panel>('/api/panel');
  const navegar = useNavigate();
  if (cargando && !datos) return <Cargando />;
  if (error || !datos) return <Aviso>{error ?? 'Sin datos'}</Aviso>;

  return (
    <>
      <Encabezado ceja="Tablero" titulo="Panel del taller" />
      <Ventana titulo="Operación de hoy">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Metrica etiqueta="Órdenes abiertas" valor={datos.abiertas} />
          <Metrica etiqueta="En diagnóstico" valor={datos.enDiagnostico} />
          <Metrica etiqueta="Por aprobar" valor={datos.porAprobar} detalle="Diagnóstico listo, falta el sí del cliente" />
          <Metrica etiqueta="En reparación" valor={datos.enReparacion} />
          <Metrica
            etiqueta="Ítems en alerta"
            valor={
              datos.itemsEnAlerta > 0 ? (
                <Link to="/inventario?alertas=1" className="hover:text-signal-blue">
                  {datos.itemsEnAlerta}
                </Link>
              ) : (
                0
              )
            }
            detalle={datos.itemsEnAlerta > 0 ? <Etiqueta tono="alerta">Reponer</Etiqueta> : 'Inventario en orden'}
          />
          <Metrica etiqueta="Facturado del mes" valor={pesos(datos.facturadoMes)} detalle={cuenta(datos.ordenesFacturadasMes, 'reparación terminada', 'reparaciones terminadas')} />
        </div>
      </Ventana>

      <section className="mt-80 grid gap-48 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <Ceja className="mb-16">Órdenes abiertas recientes</Ceja>
          <Tabla columnas={['Orden', 'Vehículo', 'Estado', 'Mecánicos', 'Actualizada']} vacia="No hay órdenes abiertas">
            {datos.ultimas.map((o) => (
              <Fila key={o.codigo} onClick={() => navegar(`/ordenes/${o.codigo}`)}>
                <Celda className="font-semibold">{o.codigo}</Celda>
                <Celda>
                  {o.vehiculo.placa} · {o.vehiculo.marca} {o.vehiculo.modelo}
                </Celda>
                <Celda>
                  <EstadoOrden estado={o.estado} />
                </Celda>
                <Celda>
                  <GrupoAvatares nombres={o.asignaciones.map((a) => a.mecanico)} />
                </Celda>
                <Celda className="text-texto-2">{fecha(o.actualizadoEn)}</Celda>
              </Fila>
            ))}
          </Tabla>
        </div>
        <div>
          <Ceja className="mb-16">Mecánicos</Ceja>
          <ul className="flex flex-col rounded-xl border border-borde">
            {datos.mecanicos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-12 border-b border-borde px-16 py-12 last:border-b-0">
                <span className="flex items-center gap-12 text-body-sm font-medium">
                  <Avatar nombre={m.nombre} />
                  {m.nombre}
                </span>
                <Etiqueta tono={m.disponible ? 'listo' : 'progreso'}>{m.disponible ? 'Disponible' : `${m.carga} en curso`}</Etiqueta>
              </li>
            ))}
            {datos.mecanicos.length === 0 && <li className="px-16 py-12 text-body-sm text-texto-2">No hay mecánicos activos</li>}
          </ul>
        </div>
      </section>
    </>
  );
}
