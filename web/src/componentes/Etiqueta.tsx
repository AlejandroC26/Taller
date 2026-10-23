import type { ReactNode } from 'react';
import type { Estado } from '../api/tipos';
import { NOMBRE_ESTADO, tonoDe } from '../logica/formato';
import type { Tono } from '../logica/formato';

const PUNTO: Record<Tono, string> = {
  vivo: 'bg-signal-orange',
  listo: 'bg-metric-green',
  neutro: 'bg-warm-granite',
};

// Pulso de estado: círculo de 6 px antes del texto.
export function Pulso({ tono = 'vivo' }: { tono?: Tono }) {
  return <span aria-hidden className={`inline-block size-6 shrink-0 rounded-full ${PUNTO[tono]}`} />;
}

// Etiqueta de instrumento: Geist Mono 12 px en mayúsculas con su pulso.
export function Etiqueta({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span className="mono inline-flex items-center gap-8 whitespace-nowrap" data-tono={tono}>
      <Pulso tono={tono} />
      {children}
    </span>
  );
}

export function EstadoOrden({ estado }: { estado: Estado }) {
  return <Etiqueta tono={tonoDe(estado)}>{NOMBRE_ESTADO[estado]}</Etiqueta>;
}
