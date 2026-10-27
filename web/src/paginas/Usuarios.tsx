import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/cliente';
import type { Sede, Usuario } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { Entrada, Seleccion } from '../componentes/Campos';
import { Etiqueta } from '../componentes/Etiqueta';
import { Aviso, Cargando, Encabezado, Tarjeta } from '../componentes/Superficies';
import { Celda, Fila, Tabla } from '../componentes/Tabla';
import { nombreRol } from '../logica/formato';
import { ROLES } from '../logica/permisos';
import { usarAccion, usarDatos } from '../logica/usarDatos';
import { usarSesion } from '../sesion/sesion';

const claseSelect = 'h-32 rounded-lg border border-borde bg-tarjeta px-8 text-body-sm';

// El cuerpo que se envía: la sede solo va para el mecánico, que siempre pertenece a una.
export function cuerpoUsuario(f: Record<string, string>) {
  const { tallerId, ...resto } = f;
  return resto.rol === 'mecanico' ? { ...resto, tallerId: Number(tallerId) } : resto;
}

function NuevoUsuario({ sedes, alCrear }: { sedes: Sede[]; alCrear: () => void }) {
  const vacio = { nombre: '', apellido: '', documento: '', telefono: '', usuario: '', clave: '', rol: 'mecanico', tallerId: '' };
  const [f, setF] = useState(vacio);
  const { ocupado, error, ejecutar } = usarAccion();
  const campo = (clave: keyof typeof vacio) => ({ value: f[clave], onChange: (e: { target: { value: string } }) => setF({ ...f, [clave]: e.target.value }) });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const r = await ejecutar(() => api('/api/usuarios', { metodo: 'POST', cuerpo: cuerpoUsuario(f) }));
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
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {nombreRol(r)}
            </option>
          ))}
        </Seleccion>
        {f.rol === 'mecanico' && (
          <Seleccion etiqueta="Sede" {...campo('tallerId')} required>
            <option value="">Elija la sede</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Seleccion>
        )}
        <div className="flex items-end gap-16 sm:col-span-2 lg:col-span-4">
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
  const { datos: sedes } = usarDatos<Sede[]>('/api/talleres');
  const [creando, setCreando] = useState(false);
  const accion = usarAccion();
  const editar = async (id: string, cuerpo: object) => {
    const r = await accion.ejecutar(() => api(`/api/usuarios/${id}`, { metodo: 'PATCH', cuerpo }));
    if (r) recargar();
  };
  // Pasar a mecánico exige sede: se propone la que ya tenía o la primera.
  const cambiarRol = (u: Usuario, rol: string) =>
    editar(u.id, rol === 'mecanico' ? { rol, tallerId: u.taller?.id ?? sedes?.[0]?.id } : { rol });

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
          sedes={sedes ?? []}
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
        <Tabla columnas={['Nombre', 'Usuario', 'Documento', 'Teléfono', 'Rol', 'Sede', 'Estado', '']}>
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
                  className={claseSelect}
                  value={u.rol}
                  disabled={u.id === actor?.id || accion.ocupado}
                  onChange={(e) => cambiarRol(u, e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {nombreRol(r)}
                    </option>
                  ))}
                </select>
              </Celda>
              <Celda>
                {u.rol === 'mecanico' ? (
                  <select
                    aria-label={`Sede de ${u.usuario}`}
                    className={claseSelect}
                    value={u.taller?.id ?? ''}
                    disabled={accion.ocupado}
                    onChange={(e) => editar(u.id, { tallerId: Number(e.target.value) })}
                  >
                    {(sedes ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-texto-3">Todas</span>
                )}
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
