import type { ReactNode } from 'react';
import { Pulso } from './Etiqueta';

// Tarjeta clara (#eeeeee sobre #101010): la figura sobre el fondo. Aquí van los
// formularios. Sin sombras: la profundidad es el contraste.
export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`superficie-clara rounded-lg bg-bone p-24 text-obsidian-canvas ${className}`}>{children}</section>
  );
}

// Tarjeta oscura: solo el borde de 1 px la dibuja.
export function Contorno({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-carbon-lift p-20 ${className}`}>{children}</section>;
}

// Marco tipo ventana para los tableros: barra con puntos y título en Mono.
export function Ventana({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-carbon-lift bg-[#0d0d0d]">
      <header className="flex h-40 items-center gap-8 border-b border-carbon-lift px-16">
        <span className="size-8 rounded-full bg-graphite-mid" />
        <span className="size-8 rounded-full bg-graphite-mid" />
        <span className="size-8 rounded-full bg-graphite-mid" />
        <span className="mono ml-8 flex items-center gap-8 text-pale-stone">
          <Pulso />
          {titulo}
        </span>
      </header>
      {children}
    </section>
  );
}

// Título de sección en Mono, con el pulso opcional.
export function Ceja({ children, pulso = false, className = '' }: { children: ReactNode; pulso?: boolean; className?: string }) {
  return (
    <p className={`mono flex items-center gap-8 text-pale-stone ${className}`}>
      {pulso && <Pulso />}
      {children}
    </p>
  );
}

export function Encabezado({
  ceja,
  titulo,
  children,
}: {
  ceja: string;
  titulo: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-40 flex flex-wrap items-end justify-between gap-24">
      <div className="min-w-0">
        <Ceja pulso className="mb-16">
          {ceja}
        </Ceja>
        <h1 className="text-heading md:text-heading-lg">{titulo}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-8">{children}</div>}
    </header>
  );
}

export function Metrica({ etiqueta, valor, detalle }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode }) {
  return (
    <div className="border-b border-carbon-lift p-20 sm:border-r">
      <p className="mono text-pale-stone">{etiqueta}</p>
      <p className="mt-16 text-heading break-words">{valor}</p>
      {detalle && <p className="mt-8 text-body-sm text-warm-granite">{detalle}</p>}
    </div>
  );
}

export function Aviso({ children, tipo = 'error' }: { children: ReactNode; tipo?: 'error' | 'info' }) {
  return (
    <p role={tipo === 'error' ? 'alert' : 'status'} className="flex items-start gap-8 text-body-sm">
      <span className="mt-6">
        <Pulso tono={tipo === 'error' ? 'vivo' : 'neutro'} />
      </span>
      <span>{children}</span>
    </p>
  );
}

export function Cargando({ texto = 'Cargando' }: { texto?: string }) {
  return (
    <p className="mono flex items-center gap-8 py-40 text-warm-granite" role="status">
      <Pulso /> {texto}…
    </p>
  );
}
