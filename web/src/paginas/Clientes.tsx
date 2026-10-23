import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/cliente';
import type { Cliente } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { aNumero, Entrada } from '../componentes/Campos';
import { Etiqueta } from '../componentes/Etiqueta';
import { Aviso, Cargando, Contorno, Encabezado, Tarjeta } from '../componentes/Superficies';
import { numero } from '../logica/formato';
import { usarAccion, usarDatos } from '../logica/usarDatos';

function NuevoCliente({ alCrear }: { alCrear: (c: Cliente) => void }) {
  const vacio = { nombre: '', apellido: '', documento: '', telefono: '', correo: '', direccion: '' };
  const [f, setF] = useState(vacio);
  const { ocupado, error, ejecutar } = usarAccion();
  const campo = (clave: keyof typeof vacio) => ({ value: f[clave], onChange: (e: { target: { value: string } }) => setF({ ...f, [clave]: e.target.value }) });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const c = await ejecutar(() =>
      api<Cliente>('/api/clientes', {
        metodo: 'POST',
        cuerpo: { ...f, correo: f.correo || undefined, direccion: f.direccion || undefined },
      }),
    );
    if (c) {
      setF(vacio);
      alCrear(c);
    }
  }

  return (
    <Tarjeta className="mb-40">
      <form onSubmit={enviar} className="grid gap-16 sm:grid-cols-2 lg:grid-cols-3">
        <h2 className="text-subheading sm:col-span-2 lg:col-span-3">Registrar cliente</h2>
        <Entrada etiqueta="Nombre" {...campo('nombre')} required />
        <Entrada etiqueta="Apellido" {...campo('apellido')} required />
        <Entrada etiqueta="Documento" {...campo('documento')} required />
        <Entrada etiqueta="Teléfono" type="tel" {...campo('telefono')} required />
        <Entrada etiqueta="Correo" type="email" {...campo('correo')} />
        <Entrada etiqueta="Dirección" {...campo('direccion')} />
        <div className="flex items-center gap-16 sm:col-span-2 lg:col-span-3">
          <Boton type="submit" variante="primario" disabled={ocupado}>
            Registrar cliente
          </Boton>
          {error && <Aviso>{error}</Aviso>}
        </div>
      </form>
    </Tarjeta>
  );
}

function NuevoVehiculo({ cliente, alCrear }: { cliente: Cliente; alCrear: () => void }) {
  const vacio = { placa: '', marca: '', modelo: '', anio: String(new Date().getFullYear()), color: '', kilometraje: '0' };
  const [f, setF] = useState(vacio);
  const { ocupado, error, ejecutar } = usarAccion();
  const campo = (clave: keyof typeof vacio) => ({ value: f[clave], onChange: (e: { target: { value: string } }) => setF({ ...f, [clave]: e.target.value }) });

  return (
    <form
      className="mt-16 grid gap-16 border-t border-borde pt-16 sm:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await ejecutar(() =>
          api(`/api/clientes/${cliente.id}/vehiculos`, {
            metodo: 'POST',
            cuerpo: { ...f, anio: aNumero(f.anio), kilometraje: aNumero(f.kilometraje) },
          }),
        );
        if (r) alCrear();
      }}
    >
      <Entrada etiqueta="Placa" {...campo('placa')} required />
      <Entrada etiqueta="Marca" {...campo('marca')} required />
      <Entrada etiqueta="Modelo" {...campo('modelo')} required />
      <Entrada etiqueta="Año" type="number" {...campo('anio')} required />
      <Entrada etiqueta="Color" {...campo('color')} />
      <Entrada etiqueta="Kilometraje" type="number" min={0} {...campo('kilometraje')} />
      <div className="flex items-center gap-16 sm:col-span-3">
        <Boton type="submit" disabled={ocupado}>
          Agregar vehículo
        </Boton>
        {error && <Aviso>{error}</Aviso>}
      </div>
    </form>
  );
}

export function Clientes() {
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [creando, setCreando] = useState(false);
  const [agregando, setAgregando] = useState<number | null>(null);
  const { datos, error, cargando, recargar } = usarDatos<Cliente[]>(`/api/clientes${buscar ? `?buscar=${encodeURIComponent(buscar)}` : ''}`);

  return (
    <>
      <Encabezado ceja="Recepción" titulo="Clientes y vehículos">
        {!creando && (
          <Boton variante="primario" onClick={() => setCreando(true)}>
            Nuevo cliente
          </Boton>
        )}
      </Encabezado>
      {creando && (
        <NuevoCliente
          alCrear={(c) => {
            setCreando(false);
            setAgregando(c.id);
            recargar();
          }}
        />
      )}
      <form
        className="mb-24 grid gap-16 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setBuscar(texto.trim());
        }}
      >
        <Entrada etiqueta="Buscar" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, documento o placa" />
        <Boton type="submit">Buscar</Boton>
      </form>
      {error && <Aviso>{error}</Aviso>}
      {cargando && !datos ? (
        <Cargando />
      ) : (
        <ul className="grid gap-24 md:grid-cols-2">
          {(datos ?? []).map((c) => (
            <li key={c.id}>
              <Contorno>
                <div className="flex flex-wrap items-start justify-between gap-16">
                  <div>
                    <p className="text-body">
                      {c.nombre} {c.apellido}
                    </p>
                    <p className="text-body-sm text-texto-2">
                      {c.documento} · {c.telefono}
                      {c.correo ? ` · ${c.correo}` : ''}
                    </p>
                  </div>
                  <Boton variante="contorno" onClick={() => setAgregando(agregando === c.id ? null : c.id)}>
                    {agregando === c.id ? 'Cerrar' : '+ Vehículo'}
                  </Boton>
                </div>
                <ul className="mt-16 flex flex-col">
                  {(c.vehiculos ?? []).map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-8 border-t border-borde py-12 text-body-sm">
                      <span>
                        <span className="mono mr-8">{v.placa}</span>
                        {v.marca} {v.modelo} {v.anio}
                      </span>
                      <span className="flex items-center gap-16 text-texto-2">
                        {numero(v.kilometraje)} km
                        {v.origen === 'concesionario' && <Etiqueta>Concesionario</Etiqueta>}
                      </span>
                    </li>
                  ))}
                  {(c.vehiculos ?? []).length === 0 && <li className="text-body-sm text-texto-2">Sin vehículos registrados</li>}
                </ul>
                {agregando === c.id && (
                  <NuevoVehiculo
                    cliente={c}
                    alCrear={() => {
                      setAgregando(null);
                      recargar();
                    }}
                  />
                )}
              </Contorno>
            </li>
          ))}
          {(datos ?? []).length === 0 && <li className="text-texto-2">No hay clientes con esa búsqueda.</li>}
        </ul>
      )}
    </>
  );
}
