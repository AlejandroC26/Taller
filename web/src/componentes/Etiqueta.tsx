import type { ReactNode } from 'react';
import type { Estado } from '../api/tipos';
import { NOMBRE_ESTADO, tonoDe } from '../logica/formato';
import type { Tono } from '../logica/formato';

// Píldoras de estado de DESIGN.md: azul con texto blanco = en progreso, menta con texto
// oscuro = hecho, violeta = espera validación, teal = aprobado, magenta = alerta.
const PILDORA: Record<Tono, string> = {
  progreso: 'bg-signal-blue text-signal-white',
  listo: 'bg-mint text-ink-black',
  revision: 'bg-brand-violet text-signal-white',
  aprobado: 'bg-teal-tag text-ink-black',
  alerta: 'bg-alerta text-ink-black',
  neutro: 'bg-chip text-texto-2',
};

const PUNTO: Record<Tono, string> = {
  progreso: 'bg-signal-blue',
  listo: 'bg-emerald',
  revision: 'bg-brand-violet',
  aprobado: 'bg-teal-tag',
  alerta: 'bg-alerta',
  neutro: 'bg-texto-3',
};

// Punto de color de 8 px, para avisos y mensajes cortos.
export function Pulso({ tono = 'progreso' }: { tono?: Tono }) {
  return <span aria-hidden className={`inline-block size-8 shrink-0 rounded-full ${PUNTO[tono]}`} />;
}

export function Etiqueta({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span
      data-tono={tono}
      className={`inline-flex items-center rounded-full px-10 py-3 text-[12px] leading-[1.4] font-semibold whitespace-nowrap ${PILDORA[tono]}`}
    >
      {children}
    </span>
  );
}

export function EstadoOrden({ estado }: { estado: Estado }) {
  return <Etiqueta tono={tonoDe(estado)}>{NOMBRE_ESTADO[estado]}</Etiqueta>;
}
