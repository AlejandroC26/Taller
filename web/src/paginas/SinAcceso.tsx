import { Encabezado } from '../componentes/Superficies';
import { usarSesion } from '../sesion/sesion';

// El rol concesionario (y cualquier rol nuevo sin pantallas) trabaja por la API o el MCP.
export function SinAcceso() {
  const { actor } = usarSesion();
  return (
    <>
      <Encabezado ceja={`Rol ${actor?.rol ?? ''}`} titulo="Sin pantallas para este rol" />
      <p className="max-w-[640px] text-texto-2">
        Este usuario se conecta por la API o el servidor MCP del taller (por ejemplo, el sistema del concesionario).
        Pida a un administrador otro rol si necesita usar el tablero.
      </p>
    </>
  );
}
