import { NavLink } from 'react-router';
import { nombreRol } from '../logica/formato';
import { enlacesDe } from '../logica/permisos';
import { usarSesion } from '../sesion/sesion';
import { InterruptorTema } from '../tema/tema';
import { Avatar } from './Avatar';
import { Boton } from './Boton';
import { Marca } from './Marca';

// Barra superior de 64 px: marca, enlaces en píldora según el rol, tema y sesión. Sin
// menú lateral. En móvil los enlaces pasan a su propia fila desplazable.
export function BarraNav() {
  const { actor, salir } = usarSesion();
  if (!actor) return null;
  return (
    <header className="sticky top-0 z-10 border-b border-borde bg-lienzo/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-24 px-16 md:px-24 lg:h-64 lg:flex-nowrap">
        <span className="flex h-56 items-center lg:h-auto">
          <Marca />
        </span>
        <nav aria-label="Principal" className="order-3 -mx-16 w-[calc(100%+32px)] overflow-x-auto border-t border-borde px-16 [scrollbar-width:none] md:-mx-24 md:w-[calc(100%+48px)] md:px-24 lg:order-none lg:mx-0 lg:w-auto lg:border-0 lg:px-0">
          <ul className="flex h-48 items-center gap-4">
            {enlacesDe(actor.rol).map((e) => (
              <li key={e.a}>
                <NavLink
                  to={e.a}
                  className={({ isActive }) =>
                    `flex h-32 items-center rounded-full px-12 text-body-sm whitespace-nowrap ${isActive ? 'bg-sutil font-semibold text-texto' : 'text-texto-2 hover:bg-sutil hover:text-texto'}`
                  }
                >
                  {e.texto}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-12">
          <InterruptorTema />
          <span className="hidden items-center gap-8 xl:flex">
            <Avatar nombre={`${actor.nombre} ${actor.apellido}`} />
            <span>
              <span className="block text-body-sm leading-tight font-medium">
                {actor.nombre} {actor.apellido}
              </span>
              <span className="block text-[12px] text-texto-3">{nombreRol(actor.rol)}</span>
            </span>
          </span>
          <Boton onClick={salir}>Salir</Boton>
        </div>
      </div>
    </header>
  );
}
