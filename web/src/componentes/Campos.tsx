import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Sobre = 'claro' | 'oscuro';

// Los campos van casi siempre en tarjetas claras; en filtros sobre el fondo oscuro se
// usa sobre="oscuro".
const CAJA: Record<Sobre, string> = {
  claro: 'bg-chalk border-pale-stone text-obsidian-canvas placeholder:text-warm-granite focus:border-obsidian-canvas',
  oscuro: 'bg-carbon-lift border-ash-stroke text-bone placeholder:text-warm-granite focus:border-pale-stone',
};
const BASE = 'w-full rounded-sm border px-12 text-body-sm outline-none';

interface ConEtiqueta {
  etiqueta: string;
  ayuda?: ReactNode;
  sobre?: Sobre;
}

function Envoltura({ id, etiqueta, ayuda, sobre = 'claro', children }: ConEtiqueta & { id: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <label htmlFor={id} className={`mono ${sobre === 'claro' ? 'text-graphite-mid' : 'text-pale-stone'}`}>
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className={`text-caption ${sobre === 'claro' ? 'text-graphite-mid' : 'text-warm-granite'}`}>{ayuda}</p>}
    </div>
  );
}

export function Entrada({ etiqueta, ayuda, sobre = 'claro', className = '', ...props }: ConEtiqueta & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} sobre={sobre}>
      <input id={id} className={`${BASE} h-40 ${CAJA[sobre]} ${className}`} {...props} />
    </Envoltura>
  );
}

export function Seleccion({
  etiqueta,
  ayuda,
  sobre = 'claro',
  className = '',
  children,
  ...props
}: ConEtiqueta & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} sobre={sobre}>
      <select id={id} className={`${BASE} h-40 ${CAJA[sobre]} ${className}`} {...props}>
        {children}
      </select>
    </Envoltura>
  );
}

export function Area({ etiqueta, ayuda, sobre = 'claro', className = '', ...props }: ConEtiqueta & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} sobre={sobre}>
      <textarea id={id} rows={3} className={`${BASE} py-8 leading-body-sm ${CAJA[sobre]} ${className}`} {...props} />
    </Envoltura>
  );
}

// Lee un número de un input; vacío es 0.
export const aNumero = (valor: string) => (valor.trim() === '' ? 0 : Number(valor));
