import type { ButtonHTMLAttributes } from 'react';

// Botones de DESIGN.md: radio de 3 px, Geist 14 px, rellenos neutros. Nunca con color de
// marca: el naranja y el verde son solo para estados.
//   oscuro:   acción en superficies oscuras (#1d1a18)
//   claro:    acción de alto énfasis en oscuro (#fafafa, texto #101010)
//   tinta:    acción dentro de una tarjeta clara (#101010, texto #eeeeee)
//   fantasma: secundaria, solo borde; sobre="claro" dentro de tarjetas claras
type Variante = 'oscuro' | 'claro' | 'tinta' | 'fantasma';

const VARIANTES: Record<Variante, string> = {
  oscuro: 'bg-carbon-lift text-bone hover:bg-graphite-mid',
  claro: 'bg-chalk text-obsidian-canvas hover:bg-bone',
  tinta: 'bg-obsidian-canvas text-bone hover:bg-carbon-lift',
  fantasma: 'border border-ash-stroke text-bone hover:border-chalk hover:text-chalk',
};

const FANTASMA_CLARO = 'border border-pale-stone text-obsidian-canvas hover:border-obsidian-canvas';

export function Boton({
  variante = 'oscuro',
  sobre = 'oscuro',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; sobre?: 'oscuro' | 'claro' }) {
  const color = variante === 'fantasma' && sobre === 'claro' ? FANTASMA_CLARO : VARIANTES[variante];
  return (
    <button
      type={type}
      className={`inline-flex h-36 cursor-pointer items-center justify-center gap-8 rounded-sm px-14 text-body-sm whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${color} ${className}`}
      {...props}
    />
  );
}
