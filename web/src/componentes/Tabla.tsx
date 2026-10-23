import type { ReactNode } from 'react';

// Tabla sobre fondo oscuro: encabezados en Mono, líneas de 1 px. En pantallas angostas
// se desplaza dentro de su caja, nunca la página.
export function Tabla({ columnas, children, vacia }: { columnas: ReactNode[]; children: ReactNode; vacia?: string }) {
  const filas = Array.isArray(children) ? children.flat().filter(Boolean).length : children ? 1 : 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-body-sm">
        <thead>
          <tr className="border-b border-ash-stroke">
            {columnas.map((c, i) => (
              <th key={i} scope="col" className="mono px-12 py-12 font-normal text-pale-stone">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
          {filas === 0 && (
            <tr>
              <td colSpan={columnas.length} className="px-12 py-24 text-warm-granite">
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
    <tr
      onClick={onClick}
      className={`border-b border-carbon-lift align-top ${onClick ? 'cursor-pointer hover:bg-carbon-lift' : ''}`}
    >
      {children}
    </tr>
  );
}

export function Celda({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-12 py-12 ${className}`}>{children}</td>;
}
