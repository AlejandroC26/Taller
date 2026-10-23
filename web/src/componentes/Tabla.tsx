import type { ReactNode } from 'react';

// Tabla densa al estilo de las listas del producto: caja con borde de 1 px y radio de
// 12 px, encabezados en Sometype Mono. En pantallas angostas se desplaza dentro de su
// caja, nunca la página.
export function Tabla({ columnas, children, vacia }: { columnas: ReactNode[]; children: ReactNode; vacia?: string }) {
  const filas = Array.isArray(children) ? children.flat().filter(Boolean).length : children ? 1 : 0;
  return (
    <div className="overflow-x-auto rounded-xl border border-borde bg-lienzo">
      <table className="w-full min-w-[640px] border-collapse text-left text-body-sm">
        <thead>
          <tr className="border-b border-borde bg-tarjeta">
            {columnas.map((c, i) => (
              <th key={i} scope="col" className="mono px-16 py-12 font-normal text-texto-3">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
          {filas === 0 && (
            <tr>
              <td colSpan={columnas.length} className="px-16 py-24 text-texto-2">
                {vacia ?? 'Sin registros'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Fila({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={`border-b border-borde align-middle last:border-b-0 ${onClick ? 'cursor-pointer hover:bg-sutil' : ''}`}>
      {children}
    </tr>
  );
}

export function Celda({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-16 py-12 ${className}`}>{children}</td>;
}
