// Lo que el taller necesita de las tiendas de repuestos: su catálogo por código universal
// (el mismo en todas las tiendas), para que el mecánico elija qué pedir. Hay dos
// implementaciones: la simulada (mientras no haya MCP_TIENDA_1_URL) y la de sus MCP.

// Un repuesto del catálogo tal como lo usa el taller: sin precio, que es de la tienda y de
// facturación. Las unidades disponibles son solo informativas.
export interface RepuestoCatalogo {
  codigo_repuesto: string;
  nombre: string;
  categoria: string;
  marcas: string[];
  unidades_disponibles: number;
  tiendas: string[];
}

export interface Catalogo {
  repuestos: RepuestoCatalogo[];
  // Las tiendas que no respondieron: se usa su último catálogo si lo había.
  sin_respuesta: string[];
  // Cuándo se pidió el catálogo más viejo de los que se muestran.
  actualizado_en: string | null;
}

export interface ProveedorTiendas {
  modo: 'simulado' | 'mcp';
  nombres: string[];
  // refrescar: pide el catálogo otra vez aunque haya uno guardado.
  catalogo(opciones?: { refrescar?: boolean }): Promise<Catalogo>;
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// Convierte una fila del catálogo de la tienda al formato del taller. precio_desde se
// descarta aquí, a propósito: nunca entra al taller.
export function delCatalogo(tienda: string, crudo: unknown): RepuestoCatalogo | null {
  if (!crudo || typeof crudo !== 'object') return null;
  const r = crudo as Record<string, unknown>;
  const codigo = texto(r.codigo_repuesto).toUpperCase();
  if (!codigo) return null;
  return {
    codigo_repuesto: codigo,
    nombre: texto(r.nombre) || codigo,
    categoria: texto(r.categoria),
    marcas: Array.isArray(r.marcas) ? r.marcas.map(texto).filter(Boolean) : [],
    unidades_disponibles: Number(r.unidades_disponibles) || 0,
    tiendas: [tienda],
  };
}

// La respuesta del agente de la tienda (hablar_con_repuestos) trae el campo catalogo:
// { tienda, total, repuestos[] } o la lista suelta. Sin ese campo, la tienda no respondió
// lo que se le pidió y se devuelve null.
export function catalogoDe(respuesta: unknown): unknown[] | null {
  if (!respuesta || typeof respuesta !== 'object') return null;
  const catalogo = (respuesta as { catalogo?: unknown }).catalogo;
  if (Array.isArray(catalogo)) return catalogo;
  if (catalogo && typeof catalogo === 'object') {
    const repuestos = (catalogo as { repuestos?: unknown }).repuestos;
    if (Array.isArray(repuestos)) return repuestos;
  }
  return null;
}

// Varias tiendas pueden tener el mismo código: sale una vez, con marcas y tiendas juntas y
// las unidades sumadas.
export function unirPorCodigo(listas: RepuestoCatalogo[][]): RepuestoCatalogo[] {
  const porCodigo = new Map<string, RepuestoCatalogo>();
  for (const r of listas.flat()) {
    const previo = porCodigo.get(r.codigo_repuesto);
    if (!previo) {
      porCodigo.set(r.codigo_repuesto, { ...r, marcas: [...r.marcas], tiendas: [...r.tiendas] });
      continue;
    }
    previo.marcas = [...new Set([...previo.marcas, ...r.marcas])];
    previo.tiendas = [...new Set([...previo.tiendas, ...r.tiendas])];
    previo.unidades_disponibles += r.unidades_disponibles;
  }
  return [...porCodigo.values()].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));
}
