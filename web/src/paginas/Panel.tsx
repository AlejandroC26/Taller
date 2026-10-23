import { Link, useNavigate } from 'react-router';
import type { Panel } from '../api/tipos';
import { Etiqueta, EstadoOrden } from '../componentes/Etiqueta';
import { Aviso, Cargando, Ceja, Encabezado, Metrica, Ventana } from '../componentes/Superficies';
import { Celda, Fila, Tabla } from '../componentes/Tabla';
import { fecha, pesos } from '../logica/formato';
import { usarDatos } from '../logica/usarDatos';

export function PanelPagina() {
  const { datos, error, cargando } = usarDatos<Panel>('/api/panel');
  const navegar = useNavigate();
  if (cargando && !datos) return <Cargando />;
  if (error || !datos) return <Aviso>{error ?? 'Sin datos'}</Aviso>;

  return (
    <>
      <Encabezado ceja="Tablero" titulo="Panel del taller" />
      <Ventana titulo="Operación en vivo">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Metrica etiqueta="Órdenes abiertas" valor={datos.abiertas} />
          <Metrica etiqueta="En diagnóstico" valor={datos.enDiagnostico} />
          <Metrica etiqueta="Por aprobar" valor={datos.porAprobar} detalle="Diagnóstico listo, falta el sí del cliente" />
          <Metrica etiqueta="En reparación" valor={datos.enReparacion} />
          <Metrica
            etiqueta="Ítems en alerta"
            valor={
              datos.itemsEnAlerta > 0 ? (
                <Link to="/inventario?alertas=1" className="hover:text-chalk">
                  {datos.itemsEnAlerta}
                </Link>
              ) : (
                0
              )
            }
            detalle={datos.itemsEnAlerta > 0 ? <Etiqueta tono="vivo">Reponer</Etiqueta> : 'Inventario en orden'}
          />
          <Metrica etiqueta="Facturado del mes" valor={pesos(datos.facturadoMes)} detalle={`${datos.ordenesFacturadasMes} reparaciones terminadas`} />
        </div>
      </Ventana>

      <section className="mt-96 grid gap-56 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <Ceja className="mb-24">Órdenes abiertas recientes</Ceja>
          <Tabla columnas={['Orden', 'Vehículo', 'Estado', 'Actualizada']} vacia="No hay órdenes abiertas">
            {datos.ultimas.map((o) => (
              <Fila key={o.codigo} onClick={() => navegar(`/ordenes/${o.codigo}`)}>
                <Celda className="mono">{o.codigo}</Celda>
                <Celda>
                  {o.vehiculo.placa} · {o.vehiculo.marca} {o.vehiculo.modelo}
                </Celda>
                <Celda>
                  <EstadoOrden estado={o.estado} />
                </Celda>
                <Celda className="text-warm-granite">{fecha(o.actualizadoEn)}</Celda>
              </Fila>
            ))}
          </Tabla>
        </div>
        <div>
          <Ceja className="mb-24">Mecánicos</Ceja>
          <ul className="flex flex-col">
            {datos.mecanicos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-16 border-b border-carbon-lift py-16">
                <span>{m.nombre}</span>
                <Etiqueta tono={m.disponible ? 'listo' : 'vivo'}>{m.disponible ? 'Disponible' : `${m.carga} en curso`}</Etiqueta>
              </li>
            ))}
            {datos.mecanicos.length === 0 && <li className="text-warm-granite">No hay mecánicos activos</li>}
          </ul>
        </div>
      </section>
    </>
  );
}
