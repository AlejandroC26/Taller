import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Logo, TALLER } from '../componentes/Marca';
import { Boton } from '../componentes/Boton';
import { Entrada } from '../componentes/Campos';
import { Aviso, Ceja } from '../componentes/Superficies';
import { inicioDe } from '../logica/permisos';
import { usarSesion } from '../sesion/sesion';
import { InterruptorTema } from '../tema/tema';

const BENEFICIOS = [
  ['Diagnóstico paso a paso.', 'Tareas, horas y repuestos con el costo en vivo.'],
  ['Reparación medida.', 'Horas por mecánico y partes descontadas del inventario.'],
  ['Inventario con alertas.', 'Sabe qué reponer antes de que falte.'],
];

function Chulo() {
  return (
    <svg viewBox="0 0 18 18" className="mt-3 size-18 shrink-0 text-signal-blue" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5l3.2 3L14 5.5" />
    </svg>
  );
}

export function Entrar() {
  const { actor, entrar } = usarSesion();
  const navegar = useNavigate();
  const desde = (useLocation().state as { desde?: string } | null)?.desde;
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (actor) return <Navigate to={inicioDe(actor.rol)} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      const yo = await entrar(usuario, clave);
      navegar(desde && desde !== '/entrar' ? desde : inicioDe(yo.rol), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-64 max-w-[1200px] items-center justify-end px-16 md:px-24">
        <InterruptorTema />
      </header>
      <main className="mx-auto grid max-w-[1200px] items-center gap-56 px-16 pt-16 pb-80 md:px-24 lg:grid-cols-[1.2fr_1fr] lg:pt-40">
        <div>
          <Logo alto={148} className="mb-28" />
          <Ceja className="mb-20">
            {TALLER.nombre} · {TALLER.lema}
          </Ceja>
          <h1 className="text-heading md:text-heading-lg xl:text-display">Cada carro, de la entrada a la entrega.</h1>
          <ul className="mt-32 flex flex-col gap-12">
            {BENEFICIOS.map(([fuerte, detalle]) => (
              <li key={fuerte} className="flex gap-12 text-body">
                <Chulo />
                <span>
                  <strong className="font-semibold text-texto">{fuerte}</strong> <span className="text-texto-2">{detalle}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <section className="borde-arcoiris w-full rounded-2xl-2 p-32 lg:max-w-[440px] lg:justify-self-end">
          <h2 className="text-heading-sm">Iniciar sesión</h2>
          <p className="mt-8 mb-28 text-body-sm text-texto-2">Use el usuario que le asignó el administrador.</p>
          <form onSubmit={enviar} className="flex flex-col gap-16">
            <Entrada etiqueta="Usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required autoFocus />
            <Entrada etiqueta="Clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
            {error && <Aviso>{error}</Aviso>}
            <Boton type="submit" variante="primario" disabled={ocupado} className="mt-8 w-full">
              {ocupado ? 'Entrando…' : 'Entrar'}
            </Boton>
          </form>
        </section>
      </main>
    </div>
  );
}
