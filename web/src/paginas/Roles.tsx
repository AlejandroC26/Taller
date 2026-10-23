import { useState } from 'react';
import { api } from '../api/cliente';
import type { RolInfo } from '../api/tipos';
import { Boton } from '../componentes/Boton';
import { Aviso, Cargando, Encabezado } from '../componentes/Superficies';
import { Celda, Fila, Tabla } from '../componentes/Tabla';
import { nombreRol } from '../logica/formato';
import { usarAccion, usarDatos } from '../logica/usarDatos';

function Descripcion({ rol, alGuardar }: { rol: RolInfo; alGuardar: (descripcion: string) => void }) {
  const [texto, setTexto] = useState(rol.descripcion);
  const cambio = texto.trim() !== rol.descripcion;
  return (
    <form
      className="flex items-center gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        alGuardar(texto.trim());
      }}
    >
      <input
        aria-label={`Descripción de ${rol.nombre}`}
        className="h-36 w-full min-w-[260px] rounded-lg border border-linea bg-lienzo px-12 text-body-sm outline-none focus:border-signal-blue"
        value={texto}
        maxLength={200}
        onChange={(e) => setTexto(e.target.value)}
      />
      {cambio && (
        <Boton type="submit" variante="suave">
          Guardar
        </Boton>
      )}
    </form>
  );
}

// Los roles son fijos: los crea la semilla y los permisos del código dependen de su
// nombre. Aquí solo se ve cuántos usuarios tiene cada uno y se edita la descripción.
export function Roles() {
  const { datos, error, cargando, recargar } = usarDatos<RolInfo[]>('/api/roles');
  const accion = usarAccion();
  const guardar = async (id: number, descripcion: string) => {
    if ((await accion.ejecutar(() => api(`/api/roles/${id}`, { metodo: 'PATCH', cuerpo: { descripcion } }))) !== undefined) recargar();
  };

  return (
    <>
      <Encabezado ceja="Administración" titulo="Roles" />
      <p className="mb-24 max-w-[720px] text-body-sm text-texto-2">
        Los roles del taller son fijos: administrador, recepcionista, mecánico y concesionario. Para darle otro rol a una
        persona, cámbielo en Usuarios.
      </p>
      {(error || accion.error) && <Aviso>{error ?? accion.error}</Aviso>}
      {cargando && !datos ? (
        <Cargando />
      ) : (
        <Tabla columnas={['Rol', 'Descripción', 'Usuarios']}>
          {(datos ?? []).map((r) => (
            <Fila key={r.id}>
              <Celda className="font-semibold">{nombreRol(r.nombre)}</Celda>
              <Celda>
                <Descripcion rol={r} alGuardar={(d) => guardar(r.id, d)} />
              </Celda>
              <Celda>{r.usuarios}</Celda>
            </Fila>
          ))}
        </Tabla>
      )}
    </>
  );
}
