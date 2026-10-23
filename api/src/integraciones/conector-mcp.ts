import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { configuracion } from './contrato';
import type { Destino } from './evento.entity';

export class SinConexion extends Error {}

// Lee el resultado de una herramienta: JSON si se puede, si no el texto.
export function leerResultado(r: { isError?: boolean; content?: unknown }): unknown {
  const textos = ((r.content ?? []) as { type: string; text?: string }[])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '');
  const texto = textos.join('\n');
  if (r.isError) throw new Error(texto || 'La herramienta devolvió un error');
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

// Llama una herramienta del MCP de otro proyecto. Abre la conexión, llama y cierra:
// las llamadas son pocas y así no quedan conexiones colgadas.
export async function llamarHerramienta(
  destino: Destino,
  herramienta: string,
  argumentos: Record<string, unknown>,
  tiempoMs = 15_000,
): Promise<unknown> {
  const conf = configuracion(destino);
  if (!conf) throw new SinConexion(`El MCP de ${destino} no está configurado (MCP_${destino.toUpperCase()}_URL)`);
  const transporte = new StreamableHTTPClientTransport(new URL(conf.url), {
    requestInit: conf.token ? { headers: { Authorization: `Bearer ${conf.token}` } } : undefined,
  });
  const cliente = new Client({ name: 'taller', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error(`El MCP de ${destino} no respondió en ${tiempoMs / 1000} s`)), tiempoMs);
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
