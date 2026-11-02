import { NOMBRE_TALLER } from '../../config';
import { llamarMcp } from '../conector-mcp';
import { tiendasConfiguradas } from '../contrato';
import type { ConfTienda } from '../contrato';
import { catalogoDe, delCatalogo, unirPorCodigo } from './proveedor';
import type { ProveedorTiendas, RepuestoCatalogo } from './proveedor';
import { tiendaSimulada } from './simulado/simulado';

// El agente de la tienda tarda unos 20 s (usa un modelo de lenguaje): se le da margen y
// el catálogo se guarda unos minutos para que el mecánico busque sin esperar.
const TIEMPO_AGENTE_MS = 45_000;
export const VIGENCIA_CATALOGO_MS = 5 * 60_000;

// Lo que se le escribe al agente. La tienda pide que el taller no llame su herramienta de
// catálogo directamente sino que le escriba a su agente (hablar_con_repuestos).
export const MENSAJE_CATALOGO = `Somos el taller ${NOMBRE_TALLER}. ¿Qué repuestos tienen disponibles? Respondan con el catálogo completo.`;

interface Guardado {
  repuestos: RepuestoCatalogo[];
  en: number;
}

// Las tiendas reales, por su MCP. Se consultan en paralelo: cada una es su propia
// instancia y una caída no tumba la búsqueda (se usa su último catálogo, si lo hay).
export function tiendasMcp(confs: ConfTienda[], llamar = llamarMcp, ahora = () => Date.now()): ProveedorTiendas {
  const guardados = new Map<string, Guardado>();
  // Si dos búsquedas llegan juntas, comparten la misma pregunta al agente.
  const enCurso = new Map<string, Promise<RepuestoCatalogo[]>>();

  const pedir = (conf: ConfTienda) => {
    const previa = enCurso.get(conf.nombre);
    if (previa) return previa;
    const promesa = (async () => {
      const respuesta = await llamar(conf, conf.nombre, 'hablar_con_repuestos', { mensaje: MENSAJE_CATALOGO }, TIEMPO_AGENTE_MS);
      const filas = catalogoDe(respuesta);
      if (!filas) throw new Error(`La tienda ${conf.nombre} no devolvió su catálogo`);
      const repuestos = filas.map((f) => delCatalogo(conf.nombre, f)).filter((r): r is RepuestoCatalogo => r !== null);
      guardados.set(conf.nombre, { repuestos, en: ahora() });
      return repuestos;
    })().finally(() => enCurso.delete(conf.nombre));
    enCurso.set(conf.nombre, promesa);
    return promesa;
  };

  return {
    modo: 'mcp',
    nombres: confs.map((c) => c.nombre),
    async catalogo({ refrescar = false } = {}) {
      const sinRespuesta: string[] = [];
      const listas = await Promise.all(
        confs.map(async (conf) => {
          const guardado = guardados.get(conf.nombre);
          if (guardado && !refrescar && ahora() - guardado.en < VIGENCIA_CATALOGO_MS) return guardado.repuestos;
          try {
            return await pedir(conf);
          } catch {
            sinRespuesta.push(conf.nombre);
            return guardado?.repuestos ?? [];
          }
        }),
      );
      const fechas = confs.map((c) => guardados.get(c.nombre)?.en).filter((f): f is number => f !== undefined);
      return {
        repuestos: unirPorCodigo(listas),
        sin_respuesta: sinRespuesta,
        actualizado_en: fechas.length ? new Date(Math.min(...fechas)).toISOString() : null,
      };
    },
  };
}

let reemplazo: ProveedorTiendas | null = null;
let real: { clave: string; proveedor: ProveedorTiendas } | null = null;

// Simulada mientras no haya MCP_TIENDA_1_URL. El proveedor real se conserva entre
// peticiones (por su caché) mientras no cambie la configuración.
export function tiendas(): ProveedorTiendas {
  if (reemplazo) return reemplazo;
  const confs = tiendasConfiguradas();
  if (!confs.length) return tiendaSimulada();
  const clave = JSON.stringify(confs);
  if (real?.clave !== clave) real = { clave, proveedor: tiendasMcp(confs) };
  return real.proveedor;
}

// Solo para pruebas.
export function usarTiendas(proveedor: ProveedorTiendas | null) {
  reemplazo = proveedor;
}
