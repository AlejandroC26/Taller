import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router';
import type { Rol } from './api/tipos';
import { BarraNav } from './componentes/BarraNav';
import { inicioDe, puede } from './logica/permisos';
import { Clientes } from './paginas/Clientes';
import { DiagnosticoPagina } from './paginas/Diagnostico';
import { Entrar } from './paginas/Entrar';
import { Integraciones } from './paginas/Integraciones';
import { Inventario } from './paginas/Inventario';
import { MisTrabajos } from './paginas/MisTrabajos';
import { OrdenDetallePagina } from './paginas/OrdenDetalle';
import { Ordenes } from './paginas/Ordenes';
import { PanelPagina } from './paginas/Panel';
import { ReparacionPagina } from './paginas/Reparacion';
import { Roles } from './paginas/Roles';
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
const taller = (rol: Rol) => puede.verInventario(rol);

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
        <Route path="panel" element={solo(puede.verPanel, <PanelPagina />)} />
        <Route path="mis-trabajos" element={solo((r) => r === 'mecanico', <MisTrabajos />)} />
        <Route path="ordenes" element={solo(taller, <Ordenes />)} />
        <Route path="ordenes/:codigo" element={solo(taller, <OrdenDetallePagina />)} />
        <Route path="ordenes/:codigo/diagnostico" element={solo(taller, <DiagnosticoPagina />)} />
        <Route path="ordenes/:codigo/reparacion" element={solo(taller, <ReparacionPagina />)} />
        <Route path="clientes" element={solo(puede.gestionarClientes, <Clientes />)} />
        <Route path="inventario" element={solo(puede.verInventario, <Inventario />)} />
        <Route path="usuarios" element={solo(puede.administrar, <Usuarios />)} />
        <Route path="roles" element={solo(puede.administrar, <Roles />)} />
        <Route path="integraciones" element={solo(puede.administrar, <Integraciones />)} />
        <Route path="sin-acceso" element={<SinAcceso />} />
        <Route path="*" element={<Inicio />} />
      </Route>
    </Routes>
  );
}
