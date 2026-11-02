import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { configuracion } from './contrato';
import type { Destino } from './evento.entity';

export class SinConexion extends Error {}

export interface ConexionMcp {
  url: string;
  token?: string;
}

// Lee el resultado de una herramienta: structuredContent si viene, si no el JSON del
// texto, y si tampoco, el texto.
export function leerResultado(r: { isError?: boolean; content?: unknown; structuredContent?: unknown }): unknown {
  const textos = ((r.content ?? []) as { type: string; text?: string }[])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '');
  const texto = textos.join('\n');
  if (r.isError) throw new Error(texto || 'La herramienta devolvió un error');
  if (r.structuredContent !== undefined && r.structuredContent !== null) return r.structuredContent;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

// Llama una herramienta de cualquier servidor MCP. Abre la conexión, llama y cierra: las
// llamadas son pocas y así no quedan conexiones colgadas.
export async function llamarMcp(
  conexion: ConexionMcp,
  nombre: string,
  herramienta: string,
  argumentos: Record<string, unknown>,
  tiempoMs = 15_000,
): Promise<unknown> {
  const transporte = new StreamableHTTPClientTransport(new URL(conexion.url), {
    requestInit: conexion.token ? { headers: { Authorization: `Bearer ${conexion.token}` } } : undefined,
  });
  const cliente = new Client({ name: 'taller', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error(`El MCP de ${nombre} no respondió en ${tiempoMs / 1000} s`)), tiempoMs);
  });
  try {
    return await Promise.race([
      (async () => {
        await cliente.connect(transporte);
        return leerResultado(await cliente.callTool({ name: herramienta, arguments: argumentos }));
      })(),
      limite,
    ]);
  } finally {
    clearTimeout(reloj);
    await cliente.close().catch(() => {});
  }
}

// Llama una herramienta del MCP de otro proyecto de la bandeja (concesionario, facturación).
export async function llamarHerramienta(
  destino: Destino,
  herramienta: string,
  argumentos: Record<string, unknown>,
  tiempoMs = 15_000,
): Promise<unknown> {
  const conf = configuracion(destino);
  if (!conf) throw new SinConexion(`El MCP de ${destino} no está configurado (MCP_${destino.toUpperCase()}_URL)`);
  return llamarMcp(conf, destino, herramienta, argumentos, tiempoMs);
}
