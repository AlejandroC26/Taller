import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

// Campos de DESIGN.md: radio de 9 px, borde Cloud (#d4d4d4) y foco azul.
const CAJA =
  'w-full rounded-lg border border-linea bg-lienzo px-12 text-body-sm text-texto outline-none placeholder:text-texto-3 focus:border-signal-blue focus:ring-3 focus:ring-signal-blue/15 disabled:bg-tarjeta disabled:text-texto-3';

interface ConEtiqueta {
  etiqueta: string;
  ayuda?: ReactNode;
}

function Envoltura({ id, etiqueta, ayuda, children }: ConEtiqueta & { id: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <label htmlFor={id} className="text-body-sm font-medium text-texto">
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="text-[12px] text-texto-2">{ayuda}</p>}
    </div>
  );
}

export function Entrada({ etiqueta, ayuda, className = '', ...props }: ConEtiqueta & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda}>
      <input id={id} className={`${CAJA} h-40 ${className}`} {...props} />
    </Envoltura>
  );
}

export function Seleccion({ etiqueta, ayuda, className = '', children, ...props }: ConEtiqueta & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda}>
      <select id={id} className={`${CAJA} h-40 ${className}`} {...props}>
        {children}
      </select>
    </Envoltura>
  );
}

export function Area({ etiqueta, ayuda, className = '', ...props }: ConEtiqueta & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda}>
      <textarea id={id} rows={3} className={`${CAJA} py-8 ${className}`} {...props} />
    </Envoltura>
  );
}

// Lee un número de un input; vacío es 0.
export const aNumero = (valor: string) => (valor.trim() === '' ? 0 : Number(valor));
