import { Encabezado } from '../componentes/Superficies';
import { usarSesion } from '../sesion/sesion';

// El rol agente (concesionario, facturación, orquestadores) trabaja por el MCP.
export function SinAcceso() {
  const { actor } = usarSesion();
  return (
    <>
      <Encabezado ceja={`Rol ${actor?.rol ?? ''}`} titulo="Sin pantallas para este rol" />
      <p className="max-w-[640px] text-texto-2">
        Este usuario es un agente: se conecta por el servidor MCP del taller (el concesionario, facturación o un orquestador).
        Pida a un administrador otro rol si necesita usar el tablero.
      </p>
    </>
  );
}
