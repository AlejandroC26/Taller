import type { ReactNode } from 'react';
import { Pulso } from './Etiqueta';

// Tarjeta: superficie Card (#f8f9fa) con borde de 1 px #e8e8e8, radio 12 px y 28 px de
// padding. Aquí van los formularios. Plana: la jerarquía es el borde, no la sombra.
export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-borde bg-tarjeta p-28 ${className}`}>{children}</section>;
}

// Tarjeta sobre el lienzo, para listas de elementos.
export function Contorno({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-borde bg-lienzo p-24 ${className}`}>{children}</section>;
}

// Panel tipo «captura del producto»: la única superficie con sombra suave (DESIGN.md:
// la excepción que despega la captura del lienzo).
export function Ventana({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl-2 border border-borde bg-lienzo shadow-subtle-2">
      <header className="flex h-48 items-center gap-8 border-b border-borde px-20">
        <span className="size-10 rounded-full bg-cloud dark:bg-carbon" />
        <span className="size-10 rounded-full bg-cloud dark:bg-carbon" />
        <span className="size-10 rounded-full bg-cloud dark:bg-carbon" />
        <span className="mono ml-8 text-texto-3">{titulo}</span>
      </header>
      {children}
    </section>
  );
}

// Etiqueta de sección: Sometype Mono en mayúsculas, gris terciario.
export function Ceja({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`mono text-texto-3 ${className}`}>{children}</p>;
}

export function Encabezado({ ceja, titulo, children }: { ceja: string; titulo: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-40 flex flex-wrap items-end justify-between gap-24">
      <div className="min-w-0">
        <Ceja className="mb-12">{ceja}</Ceja>
        <h1 className="text-heading-sm md:text-heading">{titulo}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-12">{children}</div>}
    </header>
  );
}

// Dato grande (DESIGN.md: «Stat Callout»): número en Plus Jakarta 700, leyenda en Inter.
export function Metrica({ etiqueta, valor, detalle }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode }) {
  return (
    <div className="border-b border-borde p-28 sm:border-r">
      <p className="mono text-texto-3">{etiqueta}</p>
      <p className="mt-12 font-plus-jakarta-sans text-heading-sm font-bold break-words text-titulo">{valor}</p>
      {detalle && <div className="mt-8 text-body-sm text-texto-2">{detalle}</div>}
    </div>
  );
}

export function Aviso({ children, tipo = 'error' }: { children: ReactNode; tipo?: 'error' | 'info' }) {
  return (
    <p role={tipo === 'error' ? 'alert' : 'status'} className="flex items-start gap-8 text-body-sm text-texto">
      <span className="mt-6">
        <Pulso tono={tipo === 'error' ? 'alerta' : 'listo'} />
      </span>
      <span>{children}</span>
    </p>
  );
}

export function Cargando({ texto = 'Cargando' }: { texto?: string }) {
  return (
    <p className="mono flex items-center gap-8 py-40 text-texto-3" role="status">
      <Pulso /> {texto}…
    </p>
  );
}
