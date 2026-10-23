import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Boton } from '../componentes/Boton';
import { Entrada } from '../componentes/Campos';
import { Pulso } from '../componentes/Etiqueta';
import { Aviso, Tarjeta } from '../componentes/Superficies';
import { inicioDe } from '../logica/permisos';
import { usarSesion } from '../sesion/sesion';

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
    <main className="mx-auto flex min-h-screen max-w-[1200px] flex-col justify-center gap-56 px-16 py-56 md:flex-row md:items-center md:justify-between md:px-24">
      <div className="max-w-[520px]">
        <p className="mono mb-24 flex items-center gap-8 tracking-[0.2em]">
          <Pulso /> Taller
        </p>
        <h1 className="text-heading-lg md:text-display">Cada carro, de la entrada a la entrega.</h1>
        <p className="mt-24 text-body text-warm-granite">
          Órdenes de servicio, diagnóstico paso a paso, horas, partes e inventario en un solo tablero.
        </p>
      </div>
      <Tarjeta className="w-full md:max-w-[420px]">
        <p className="mono mb-16 flex items-center gap-8">
          <Pulso /> Acceso
        </p>
        <h2 className="mb-24 text-heading">Iniciar sesión</h2>
        <form onSubmit={enviar} className="flex flex-col gap-16">
          <Entrada etiqueta="Usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required autoFocus />
          <Entrada etiqueta="Clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
          {error && <Aviso>{error}</Aviso>}
          <Boton type="submit" variante="tinta" disabled={ocupado} className="mt-8">
            {ocupado ? 'Entrando…' : 'Entrar'}
          </Boton>
        </form>
      </Tarjeta>
    </main>
  );
}
