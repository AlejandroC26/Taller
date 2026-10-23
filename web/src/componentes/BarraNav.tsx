import { NavLink } from 'react-router';
import { enlacesDe } from '../logica/permisos';
import { usarSesion } from '../sesion/sesion';
import { Boton } from './Boton';

// Barra superior fija de 64 px: marca a la izquierda, enlaces según el rol, sin menú
// lateral. En móvil los enlaces se desplazan en su propia fila.
export function BarraNav() {
  const { actor, salir } = usarSesion();
  if (!actor) return null;
  return (
    <header className="sticky top-0 z-10 border-b border-carbon-lift bg-obsidian-canvas">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-24 px-16 md:h-64 md:flex-nowrap md:px-24">
        <span className="mono flex h-56 items-center tracking-[0.2em] text-bone md:h-auto">Taller</span>
        <nav aria-label="Principal" className="order-3 -mx-16 w-[calc(100%+32px)] overflow-x-auto border-t border-carbon-lift px-16 md:order-none md:mx-0 md:w-auto md:border-0 md:px-0">
          <ul className="flex h-48 items-center gap-24">
            {enlacesDe(actor.rol).map((e) => (
              <li key={e.a}>
                <NavLink
                  to={e.a}
                  className={({ isActive }) =>
                    `text-body-sm whitespace-nowrap uppercase ${isActive ? 'text-chalk underline underline-offset-8' : 'text-pale-stone hover:text-chalk'}`
                  }
                >
                  {e.texto}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-16">
          <span className="hidden text-right sm:block">
            <span className="block text-body-sm">{actor.nombre} {actor.apellido}</span>
            <span className="mono block text-warm-granite">{actor.rol}</span>
          </span>
          <Boton variante="fantasma" onClick={salir}>
            Salir
          </Boton>
        </div>
      </div>
    </header>
  );
}
