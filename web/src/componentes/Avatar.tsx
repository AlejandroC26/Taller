// Avatares redondos con iniciales (DESIGN.md: «Rounded Avatar Cluster»). El color sale
// del nombre, así cada persona conserva el suyo.
const FONDOS = ['bg-brand-violet text-signal-white', 'bg-signal-blue text-signal-white', 'bg-teal-tag text-ink-black', 'bg-chip text-texto'];

export const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

const fondoDe = (nombre: string) => FONDOS[[...nombre].reduce((s, c) => s + c.charCodeAt(0), 0) % FONDOS.length];

export function Avatar({ nombre, tamano = 28 }: { nombre: string; tamano?: number }) {
  return (
    <span
      title={nombre}
      style={{ width: tamano, height: tamano, fontSize: tamano * 0.4 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-plus-jakarta-sans font-bold ring-2 ring-lienzo ${fondoDe(nombre)}`}
    >
      {iniciales(nombre)}
    </span>
  );
}

// Grupo superpuesto: varios mecánicos en una orden.
export function GrupoAvatares({ nombres }: { nombres: string[] }) {
  const unicos = [...new Set(nombres)];
  if (unicos.length === 0) return <span className="text-texto-3">—</span>;
  return (
    <span className="inline-flex items-center" aria-label={unicos.join(', ')}>
      {unicos.map((n, i) => (
        <span key={n} className={i > 0 ? '-ml-8' : ''}>
          <Avatar nombre={n} />
        </span>
      ))}
    </span>
  );
}
