// Identidad del taller. El logo (web/public/logo-pulgas-locas.webp) tiene fondo blanco y
// no es transparente: va sobre una placa blanca para que en el tema oscuro no quede un
// cuadro suelto. En el tema claro la placa se funde con el lienzo.
export const TALLER = {
  nombre: 'Taller Pulgas Locas',
  corto: 'Pulgas Locas',
  lema: 'Mecánica general',
  logo: '/logo-pulgas-locas.webp',
};

export function Logo({ alto = 40, className = '' }: { alto?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-signal-white ${className}`}
      style={{ height: alto, width: Math.round(alto * 0.86) }}
    >
      <img src={TALLER.logo} alt={`Logo del ${TALLER.nombre}`} className="h-full w-full object-contain" />
    </span>
  );
}

// Logo y nombre, para la barra superior y la entrada.
export function Marca() {
  return (
    <span className="flex items-center gap-12">
      <Logo />
      <span className="leading-none">
        <span className="block font-plus-jakarta-sans text-[18px] font-extrabold tracking-[-0.03em] text-titulo">{TALLER.corto}</span>
        <span className="mono mt-4 block text-[10px] tracking-[0.08em] text-texto-3">{TALLER.lema}</span>
      </span>
    </span>
  );
}
