import { useState } from 'react';
import { api } from '../api/cliente';
import type { RolInfo } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { Entrada } from '../componentes/Campos';
import { Etiqueta } from '../componentes/Etiqueta';
import { Aviso, Cargando, Encabezado, Tarjeta } from '../componentes/Superficies';
import { Celda, Fila, Tabla } from '../componentes/Tabla';
import { usarAccion, usarDatos } from '../logica/usarDatos';

function Descripcion({ rol, alGuardar }: { rol: RolInfo; alGuardar: (descripcion: string) => void }) {
  const [texto, setTexto] = useState(rol.descripcion);
  const cambio = texto.trim() !== rol.descripcion;
  return (
    <form
      className="flex gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        alGuardar(texto.trim());
      }}
    >
      <input
        aria-label={`Descripción de ${rol.nombre}`}
        className="h-32 w-full min-w-[240px] rounded-sm border border-ash-stroke bg-carbon-lift px-8 text-body-sm"
        value={texto}
        maxLength={200}
        onChange={(e) => setTexto(e.target.value)}
      />
      {cambio && (
        <Boton type="submit" className="h-32">
          Guardar
        </Boton>
      )}
    </form>
  );
}

export function Roles() {
  const { datos, error, cargando, recargar } = usarDatos<RolInfo[]>('/api/roles');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const accion = usarAccion();
  const hacer = async (trabajo: () => Promise<unknown>) => {
    if ((await accion.ejecutar(trabajo)) !== undefined) recargar();
  };

  return (
    <>
      <Encabezado ceja="Administración" titulo="Roles" />
      <Tarjeta className="mb-40">
        <form
          className="grid gap-16 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void hacer(async () => {
              await api('/api/roles', { metodo: 'POST', cuerpo: { nombre, descripcion } });
              setNombre('');
              setDescripcion('');
              return true;
            });
          }}
        >
          <Entrada etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="jefe_taller" required />
          <Entrada etiqueta="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          <Boton type="submit" variante="tinta" disabled={accion.ocupado}>
            Crear rol
          </Boton>
        </form>
        <p className="mt-16 text-caption text-graphite-mid">
          Los permisos del sistema están atados a los roles administrador, recepcionista, mecánico y concesionario. Un rol nuevo no tiene pantallas hasta que se le den permisos en el código.
        </p>
      </Tarjeta>
      {(error || accion.error) && <Aviso>{error ?? accion.error}</Aviso>}
      {cargando && !datos ? (
        <Cargando />
      ) : (
        <Tabla columnas={['Rol', 'Descripción', 'Usuarios', 'Tipo', '']}>
          {(datos ?? []).map((r) => (
            <Fila key={r.id}>
              <Celda className="mono">{r.nombre}</Celda>
              <Celda>
                <Descripcion rol={r} alGuardar={(d) => hacer(() => api(`/api/roles/${r.id}`, { metodo: 'PATCH', cuerpo: { descripcion: d } }))} />
              </Celda>
              <Celda>{r.usuarios}</Celda>
              <Celda>
                <Etiqueta>{r.sistema ? 'Sistema' : 'Propio'}</Etiqueta>
              </Celda>
              <Celda>
                {!r.sistema && (
                  <Boton variante="fantasma" disabled={accion.ocupado || r.usuarios > 0} onClick={() => hacer(() => api(`/api/roles/${r.id}`, { metodo: 'DELETE' }))}>
                    Borrar
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
