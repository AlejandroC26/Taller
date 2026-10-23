import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, ErrorApi } from '../api/cliente';
import { ESTADOS } from '../api/tipos';
import type { Orden, OrdenDetalle } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { aNumero, Area, Entrada, Seleccion } from '../componentes/Campos';
import { EstadoOrden } from '../componentes/Etiqueta';
import { Aviso, Cargando, Encabezado, Tarjeta } from '../componentes/Superficies';
import { Celda, Fila, Tabla } from '../componentes/Tabla';
import { fecha, NOMBRE_ESTADO } from '../logica/formato';
import { puede } from '../logica/permisos';
import { usarAccion, usarDatos } from '../logica/usarDatos';
import { usarSesion } from '../sesion/sesion';

export function NuevaOrden({ alCrear, alCerrar }: { alCrear: (o: OrdenDetalle) => void; alCerrar: () => void }) {
  const [placa, setPlaca] = useState('');
  const [motivo, setMotivo] = useState('');
  const [kilometraje, setKilometraje] = useState('');
  const { ocupado, error, ejecutar } = usarAccion();
  const [sinVehiculo, setSinVehiculo] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setSinVehiculo(false);
    const orden = await ejecutar(async () => {
      try {
        return await api<OrdenDetalle>('/api/ordenes', {
          metodo: 'POST',
          cuerpo: { placa, motivo, ...(kilometraje ? { kilometraje: aNumero(kilometraje) } : {}) },
        });
      } catch (err) {
        if (err instanceof ErrorApi && err.estado === 404) setSinVehiculo(true);
        throw err;
      }
    });
    if (orden) alCrear(orden);
  }

  return (
    <Tarjeta className="mb-40">
      <form onSubmit={enviar} className="grid gap-16 md:grid-cols-[1fr_1fr_2fr]">
        <h2 className="text-heading md:col-span-3">Nueva orden de servicio</h2>
        <Entrada etiqueta="Placa" value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC123" required />
        <Entrada etiqueta="Kilometraje" type="number" min={0} value={kilometraje} onChange={(e) => setKilometraje(e.target.value)} />
        <Area etiqueta="Motivo de ingreso" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Lo que reporta el cliente" required rows={2} />
        <div className="flex flex-wrap items-center gap-16 md:col-span-3">
          <Boton type="submit" variante="tinta" disabled={ocupado}>
            {ocupado ? 'Creando…' : 'Abrir orden'}
          </Boton>
          <Boton variante="fantasma" sobre="claro" onClick={alCerrar}>
            Cerrar
          </Boton>
          {error && (
            <Aviso>
              {error}
              {sinVehiculo && (
                <>
                  {' '}
                  <Link to="/clientes" className="underline">
                    Registrar cliente y vehículo
                  </Link>
                </>
              )}
            </Aviso>
          )}
        </div>
      </form>
    </Tarjeta>
  );
}

export function Ordenes() {
  const { actor } = usarSesion();
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const estado = parametros.get('estado') ?? '';
  const buscar = parametros.get('buscar') ?? '';
  const [texto, setTexto] = useState(buscar);
  const [creando, setCreando] = useState(false);
  const consulta = new URLSearchParams({ ...(estado ? { estado } : {}), ...(buscar ? { buscar } : {}) }).toString();
  const { datos, error, cargando } = usarDatos<Orden[]>(`/api/ordenes${consulta ? `?${consulta}` : ''}`);
  const gestiona = actor ? puede.gestionarOrdenes(actor.rol) : false;

  const cambiar = (clave: string, valor: string) => {
    const nuevos = new URLSearchParams(parametros);
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    setParametros(nuevos, { replace: true });
  };

  return (
    <>
      <Encabezado ceja={gestiona ? 'Recepción' : 'Asignadas a usted'} titulo="Órdenes de servicio">
        {gestiona && !creando && (
          <Boton variante="claro" onClick={() => setCreando(true)}>
            Nueva orden
          </Boton>
        )}
      </Encabezado>
      {creando && <NuevaOrden alCerrar={() => setCreando(false)} alCrear={(o) => navegar(`/ordenes/${o.codigo}`)} />}

      <form
        className="mb-24 grid gap-16 sm:grid-cols-[2fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          cambiar('buscar', texto.trim());
        }}
      >
        <Entrada sobre="oscuro" etiqueta="Buscar" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Placa, cliente o código" />
        <Seleccion sobre="oscuro" etiqueta="Estado" value={estado} onChange={(e) => cambiar('estado', e.target.value)}>
          <option value="">Todos</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {NOMBRE_ESTADO[e]}
            </option>
          ))}
        </Seleccion>
        <Boton type="submit">Buscar</Boton>
      </form>

      {error && <Aviso>{error}</Aviso>}
      {cargando && !datos ? (
        <Cargando />
      ) : (
        <Tabla columnas={['Orden', 'Vehículo', 'Cliente', 'Estado', 'Mecánicos', 'Actualizada']} vacia="No hay órdenes con esos filtros">
          {(datos ?? []).map((o) => (
            <Fila key={o.codigo} onClick={() => navegar(`/ordenes/${o.codigo}`)}>
              <Celda className="mono">{o.codigo}</Celda>
              <Celda>
                <span className="block">{o.vehiculo.placa}</span>
                <span className="text-warm-granite">
                  {o.vehiculo.marca} {o.vehiculo.modelo}
                </span>
              </Celda>
              <Celda>{o.cliente.nombre}</Celda>
              <Celda>
                <EstadoOrden estado={o.estado} />
              </Celda>
              <Celda className="text-warm-granite">{[...new Set(o.asignaciones.map((a) => a.mecanico))].join(', ') || '—'}</Celda>
              <Celda className="text-warm-granite">{fecha(o.actualizadoEn)}</Celda>
            </Fila>
          ))}
        </Tabla>
      )}
    </>
  );
}
