import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/cliente';
import type { RolInfo, Usuario } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { Entrada, Seleccion } from '../componentes/Campos';
import { Etiqueta } from '../componentes/Etiqueta';
import { Aviso, Cargando, Encabezado, Tarjeta } from '../componentes/Superficies';
import { Celda, Fila, Tabla } from '../componentes/Tabla';
import { nombreRol } from '../logica/formato';
import { usarAccion, usarDatos } from '../logica/usarDatos';
import { usarSesion } from '../sesion/sesion';

function NuevoUsuario({ roles, alCrear }: { roles: RolInfo[]; alCrear: () => void }) {
  const vacio = { nombre: '', apellido: '', documento: '', telefono: '', usuario: '', clave: '', rol: 'mecanico' };
  const [f, setF] = useState(vacio);
  const { ocupado, error, ejecutar } = usarAccion();
  const campo = (clave: keyof typeof vacio) => ({ value: f[clave], onChange: (e: { target: { value: string } }) => setF({ ...f, [clave]: e.target.value }) });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const r = await ejecutar(() => api('/api/usuarios', { metodo: 'POST', cuerpo: f }));
    if (r) {
      setF(vacio);
      alCrear();
    }
  }

  return (
    <Tarjeta className="mb-40">
      <form onSubmit={enviar} className="grid gap-16 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="text-subheading sm:col-span-2 lg:col-span-4">Nuevo usuario</h2>
        <Entrada etiqueta="Nombre" {...campo('nombre')} required />
        <Entrada etiqueta="Apellido" {...campo('apellido')} required />
        <Entrada etiqueta="Documento" {...campo('documento')} required />
        <Entrada etiqueta="Teléfono" type="tel" {...campo('telefono')} required />
        <Entrada etiqueta="Usuario" {...campo('usuario')} autoComplete="off" required />
        <Entrada etiqueta="Clave" type="password" {...campo('clave')} autoComplete="new-password" minLength={10} ayuda="Mínimo 10 caracteres" required />
        <Seleccion etiqueta="Rol" {...campo('rol')}>
          {roles.map((r) => (
            <option key={r.id} value={r.nombre}>
              {nombreRol(r.nombre)}
            </option>
          ))}
        </Seleccion>
        <div className="flex items-end gap-16">
          <Boton type="submit" variante="primario" disabled={ocupado}>
            Crear usuario
          </Boton>
        </div>
        {error && (
          <div className="sm:col-span-2 lg:col-span-4">
            <Aviso>{error}</Aviso>
          </div>
        )}
      </form>
    </Tarjeta>
  );
}

export function Usuarios() {
  const { actor } = usarSesion();
  const { datos, error, cargando, recargar } = usarDatos<Usuario[]>('/api/usuarios');
  const { datos: roles } = usarDatos<RolInfo[]>('/api/roles');
  const [creando, setCreando] = useState(false);
  const accion = usarAccion();
  const editar = async (id: string, cuerpo: object) => {
    const r = await accion.ejecutar(() => api(`/api/usuarios/${id}`, { metodo: 'PATCH', cuerpo }));
    if (r) recargar();
  };

  return (
    <>
      <Encabezado ceja="Administración" titulo="Usuarios">
        {!creando && (
          <Boton variante="primario" onClick={() => setCreando(true)}>
            Nuevo usuario
          </Boton>
        )}
      </Encabezado>
      {creando && (
        <NuevoUsuario
          roles={roles ?? []}
          alCrear={() => {
            setCreando(false);
            recargar();
          }}
        />
      )}
      {(error || accion.error) && <Aviso>{error ?? accion.error}</Aviso>}
      {cargando && !datos ? (
        <Cargando />
      ) : (
        <Tabla columnas={['Nombre', 'Usuario', 'Documento', 'Teléfono', 'Rol', 'Estado', '']}>
          {(datos ?? []).map((u) => (
            <Fila key={u.id}>
              <Celda>
                {u.nombre} {u.apellido}
              </Celda>
              <Celda className="mono">{u.usuario}</Celda>
              <Celda>{u.documento}</Celda>
              <Celda>{u.telefono}</Celda>
              <Celda>
                <select
                  aria-label={`Rol de ${u.usuario}`}
                  className="h-32 rounded-sm border border-borde bg-tarjeta px-8 text-body-sm"
                  value={u.rol}
                  disabled={u.id === actor?.id || accion.ocupado}
                  onChange={(e) => editar(u.id, { rol: e.target.value })}
                >
                  {(roles ?? []).map((r) => (
                    <option key={r.id} value={r.nombre}>
                      {nombreRol(r.nombre)}
                    </option>
                  ))}
                </select>
              </Celda>
              <Celda>
                <Etiqueta tono={u.activo ? 'listo' : 'neutro'}>{u.activo ? 'Activo' : 'Inactivo'}</Etiqueta>
              </Celda>
              <Celda>
                {u.id !== actor?.id && (
                  <Boton variante="contorno" disabled={accion.ocupado} onClick={() => editar(u.id, { activo: !u.activo })}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </Boton>
                )}
              </Celda>
            </Fila>
          ))}
        </Tabla>
      )}
    </>
  );
}
