import type { ButtonHTMLAttributes } from 'react';

// Botones de DESIGN.md: siempre píldora (9999px), Plus Jakarta Sans 14 px en 700.
//   primario: la acción principal — relleno #202020 (en oscuro, Mist #f8f9fa)
//   contorno: secundaria — borde #e8e8e8, sin relleno
//   azul:     acción interactiva con borde azul (#0091ff); nunca como acción principal
//   suave:    compacta, para filas y barras (fondo sutil)
// El violeta de marca nunca rellena un botón.
type Variante = 'primario' | 'contorno' | 'azul' | 'suave';

const VARIANTES: Record<Variante, string> = {
  primario: 'h-40 px-24 bg-accion text-accion-texto hover:opacity-85',
  contorno: 'h-40 px-20 border border-borde bg-lienzo text-texto hover:bg-sutil',
  azul: 'h-40 px-20 border border-signal-blue text-signal-blue hover:bg-signal-blue/5',
  suave: 'h-32 px-12 bg-sutil text-texto hover:bg-chip',
};

export function Boton({
  variante = 'contorno',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type={type}
      data-variante={variante}
      className={`inline-flex cursor-pointer items-center justify-center gap-8 rounded-full font-plus-jakarta-sans text-body-sm font-bold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTES[variante]} ${className}`}
      {...props}
    />
  );
}
