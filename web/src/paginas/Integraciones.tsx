import { api } from '../api/cliente';
import type { EstadoIntegraciones } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { Etiqueta } from '../componentes/Etiqueta';
import { Aviso, Cargando, Ceja, Contorno, Encabezado } from '../componentes/Superficies';
import { Celda, Fila, Tabla } from '../componentes/Tabla';
import { fecha } from '../logica/formato';
import type { Tono } from '../logica/formato';
import { usarAccion, usarDatos } from '../logica/usarDatos';

const TONO: Record<string, Tono> = { enviado: 'listo', pendiente: 'progreso', fallido: 'alerta', desactivado: 'neutro' };

// Los MCP de los otros proyectos (partes, facturación, concesionario) y la bandeja de
// salida hacia ellos.
export function Integraciones() {
  const { datos, error, cargando, recargar } = usarDatos<EstadoIntegraciones>('/api/integraciones');
  const accion = usarAccion();
  if (cargando && !datos) return <Cargando />;

  return (
    <>
      <Encabezado ceja="Administración" titulo="Integraciones">
        <Boton
          variante="primario"
          disabled={accion.ocupado}
          onClick={async () => {
            await accion.ejecutar(() => api('/api/integraciones/reintentar', { metodo: 'POST' }));
            recargar();
          }}
        >
          Reintentar envíos
        </Boton>
      </Encabezado>
      {(error || accion.error) && <Aviso>{error ?? accion.error}</Aviso>}
      <ul className="grid gap-24 md:grid-cols-3">
        {(datos?.destinos ?? []).map((d) => (
          <li key={d.destino}>
            <Contorno className="flex h-full flex-col gap-16">
              <div className="flex items-center justify-between gap-8">
                <span className="mono">{d.destino}</span>
                <Etiqueta tono={d.configurado ? 'listo' : 'neutro'}>{d.configurado ? 'Conectado' : 'Sin conectar'}</Etiqueta>
              </div>
              <p className="text-body-sm text-texto-2">{d.descripcion}</p>
              <div>
                <Ceja className="mb-8">Herramientas esperadas</Ceja>
                <ul className="flex flex-col gap-8 text-body-sm">
                  {Object.keys(d.herramientas).map((h) => (
                    <li key={h} className="mono text-texto">
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-auto text-[12px] text-texto-2">
                {Object.entries(d.eventos)
                  .map(([estado, total]) => `${total} ${estado}`)
                  .join(' · ') || 'Sin eventos'}
              </p>
              {!d.configurado && <p className="text-[12px] text-texto-2">Defina MCP_{d.destino.toUpperCase()}_URL en SENA-IA/.env</p>}
            </Contorno>
          </li>
        ))}
      </ul>
      <Ceja className="mt-56 mb-16">Últimos eventos</Ceja>
      <Tabla columnas={['#', 'Destino', 'Herramienta', 'Estado', 'Intentos', 'Creado', 'Detalle']} vacia="La bandeja está vacía">
        {(datos?.ultimos ?? []).map((e) => (
          <Fila key={e.id}>
            <Celda className="mono">{e.id}</Celda>
            <Celda>{e.destino}</Celda>
            <Celda className="mono">{e.herramienta}</Celda>
            <Celda>
              <Etiqueta tono={TONO[e.estado] ?? 'neutro'}>{e.estado}</Etiqueta>
            </Celda>
            <Celda>{e.intentos}</Celda>
            <Celda className="text-texto-2">{fecha(e.creadoEn)}</Celda>
            <Celda className="text-texto-2">{e.ultimoError ?? ''}</Celda>
          </Fila>
        ))}
      </Tabla>
    </>
  );
}
