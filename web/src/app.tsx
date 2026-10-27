import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router';
import type { Rol } from './api/tipos';
import { BarraNav } from './componentes/BarraNav';
import { inicioDe, puede } from './logica/permisos';
import { DiagnosticoPagina } from './paginas/Diagnostico';
import { Entrar } from './paginas/Entrar';
import { MisTrabajos } from './paginas/MisTrabajos';
import { OrdenDetallePagina } from './paginas/OrdenDetalle';
import { ReparacionPagina } from './paginas/Reparacion';
import { SinAcceso } from './paginas/SinAcceso';
import { Usuarios } from './paginas/Usuarios';
import { RutaProtegida, usarSesion } from './sesion/sesion';

function Plantilla() {
  return (
    <>
      <BarraNav />
      <main className="mx-auto max-w-[1200px] px-16 py-40 md:px-24 md:py-56">
        <Outlet />
      </main>
    </>
  );
}

function Inicio() {
  const { actor } = usarSesion();
  return <Navigate to={actor ? inicioDe(actor.rol) : '/entrar'} replace />;
}

const solo = (permitido: (rol: Rol) => boolean, pagina: ReactNode) => (
  <RutaProtegida permitido={permitido}>{pagina}</RutaProtegida>
);
const taller = puede.usarTablero;

// La web es la parte manual del mecánico (y Usuarios para el administrador). Lo demás
// del flujo lo mueven los agentes por el MCP.
export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      <Route
        element={
          <RutaProtegida>
            <Plantilla />
          </RutaProtegida>
        }
      >
        <Route index element={<Inicio />} />
        <Route path="mis-trabajos" element={solo(taller, <MisTrabajos />)} />
        <Route path="ordenes/:codigo" element={solo(taller, <OrdenDetallePagina />)} />
        <Route path="ordenes/:codigo/diagnostico" element={solo(taller, <DiagnosticoPagina />)} />
        <Route path="ordenes/:codigo/reparacion" element={solo(taller, <ReparacionPagina />)} />
        <Route path="usuarios" element={solo(puede.administrar, <Usuarios />)} />
        <Route path="sin-acceso" element={<SinAcceso />} />
        <Route path="*" element={<Inicio />} />
      </Route>
    </Routes>
  );
}
