import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Tema = 'claro' | 'oscuro';
export const LLAVE_TEMA = 'taller.tema';

// El tema elegido se recuerda en este navegador. Sin elección, claro (el de DESIGN.md).
export function temaGuardado(): Tema {
  try {
    return localStorage.getItem(LLAVE_TEMA) === 'oscuro' ? 'oscuro' : 'claro';
  } catch {
    return 'claro';
  }
}

export function aplicarTema(tema: Tema) {
  document.documentElement.dataset.tema = tema;
}

const Contexto = createContext<{ tema: Tema; alternar: () => void } | null>(null);

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaGuardado);

  useEffect(() => {
    aplicarTema(tema);
    try {
      localStorage.setItem(LLAVE_TEMA, tema);
    } catch {
      // Sin almacenamiento el tema dura lo que la pestaña.
    }
  }, [tema]);

  const alternar = useCallback(() => setTema((t) => (t === 'claro' ? 'oscuro' : 'claro')), []);
  const valor = useMemo(() => ({ tema, alternar }), [tema, alternar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usarTema() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('usarTema debe usarse dentro de <TemaProvider>');
  return valor;
}

// Interruptor de tema: un switch accesible con sol y luna.
export function InterruptorTema() {
  const { tema, alternar } = usarTema();
  const oscuro = tema === 'oscuro';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={oscuro}
      aria-label="Tema oscuro"
      title={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      onClick={alternar}
      className="relative inline-flex h-28 w-52 shrink-0 cursor-pointer items-center rounded-full border border-borde bg-tarjeta px-4"
    >
      <span
        aria-hidden
        className={`flex size-20 items-center justify-center rounded-full bg-accion text-accion-texto transition-transform duration-300 ease-asentar ${oscuro ? 'translate-x-24' : 'translate-x-0'}`}
      >
        {oscuro ? (
          <svg viewBox="0 0 16 16" className="size-12" fill="currentColor">
            <path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="size-12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="8" cy="8" r="2.8" />
            <path d="M8 1.5v1.3M8 13.2v1.3M1.5 8h1.3M13.2 8h1.3M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
          </svg>
        )}
      </span>
    </button>
  );
}
