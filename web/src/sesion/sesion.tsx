import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { api, guardarToken, leerToken, SESION_VENCIDA } from '../api/cliente';
import type { Actor, Rol } from '../api/tipos';
import { Cargando } from '../componentes/Superficies';
import { inicioDe } from '../logica/permisos';

interface Sesion {
  actor: Actor | null;
  cargando: boolean;
  entrar: (usuario: string, clave: string) => Promise<Actor>;
  salir: () => void;
}

const Contexto = createContext<Sesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [actor, setActor] = useState<Actor | null>(null);
  const [cargando, setCargando] = useState(() => leerToken() !== null);

  // Con un token guardado, se pregunta quién es: si venció, la API responde 401.
  useEffect(() => {
    if (!leerToken()) return;
    api<Actor>('/api/auth/yo')
      .then(setActor)
      .catch(() => setActor(null))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    const vencida = () => setActor(null);
    window.addEventListener(SESION_VENCIDA, vencida);
    return () => window.removeEventListener(SESION_VENCIDA, vencida);
  }, []);

  const entrar = useCallback(async (usuario: string, clave: string) => {
    const r = await api<{ token: string; usuario: Actor }>('/api/auth/entrar', {
      metodo: 'POST',
      cuerpo: { usuario, clave },
    });
    guardarToken(r.token);
    setActor(r.usuario);
    return r.usuario;
  }, []);

  const salir = useCallback(() => {
    guardarToken(null);
    setActor(null);
  }, []);

  const valor = useMemo(() => ({ actor, cargando, entrar, salir }), [actor, cargando, entrar, salir]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usarSesion(): Sesion {
  const sesion = useContext(Contexto);
  if (!sesion) throw new Error('usarSesion debe usarse dentro de <SesionProvider>');
  return sesion;
}

// Exige sesión y, opcionalmente, un permiso. Sin sesión va a /entrar; sin permiso, a
// su página de inicio.
export function RutaProtegida({ permitido, children }: { permitido?: (rol: Rol) => boolean; children: ReactNode }) {
  const { actor, cargando } = usarSesion();
  const ubicacion = useLocation();
  if (cargando) {
    return (
      <div className="mx-auto max-w-[1200px] px-16 md:px-24">
        <Cargando texto="Verificando sesión" />
      </div>
    );
  }
  if (!actor) return <Navigate to="/entrar" replace state={{ desde: ubicacion.pathname }} />;
  if (permitido && !permitido(actor.rol)) return <Navigate to={inicioDe(actor.rol)} replace />;
  return <>{children}</>;
}
