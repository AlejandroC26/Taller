// Cliente de prueba del servidor MCP, con el token MCP de la sesión iniciada.
//   node pruebas/probar-mcp.mjs                                    lista las herramientas
//   node pruebas/probar-mcp.mjs consultar_inventario solo_alertas=true
//   node pruebas/probar-mcp.mjs crear_orden pruebas/orden.json
//   node pruebas/probar-mcp.mjs --token <token-mcp>                otro usuario
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { readFileSync } from 'node:fs';
import { BASE, leerToken } from './comun.mjs';

const args = process.argv.slice(2);
let url = `${BASE}/mcp`;
let token;
for (const opcion of ['--url', '--token']) {
  const i = args.indexOf(opcion);
  if (i >= 0) {
    const [, valor] = args.splice(i, 2);
    if (opcion === '--url') url = valor;
    else token = valor;
  }
}
const [herramienta, ...resto] = args;

// Los valores k=v se convierten: true/false a booleano y los números a número.
const valor = (v) => (v === 'true' ? true : v === 'false' ? false : v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);

const transporte = new StreamableHTTPClientTransport(new URL(url), {
  requestInit: { headers: { Authorization: `Bearer ${token ?? leerToken('mcp')}` } },
});
const cliente = new Client({ name: 'probar-mcp', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
const inicio = Date.now();
try {
  await cliente.connect(transporte);
  console.log(`Conectado a "${cliente.getServerVersion()?.name}" ${cliente.getServerVersion()?.version}.`);
  if (!herramienta) {
    const { tools } = await cliente.listTools();
    console.log(`Herramientas: ${tools.length}`);
    for (const t of tools) console.log(`- ${t.name} (${t.annotations?.readOnlyHint ? 'solo lectura' : t.annotations?.destructiveHint ? 'DESTRUCTIVA' : 'escribe'})`);
  } else {
    let argumentos = {};
    if (resto[0]?.endsWith('.json')) argumentos = JSON.parse(readFileSync(resto[0], 'utf8'));
    else for (const par of resto) argumentos[par.slice(0, par.indexOf('='))] = valor(par.slice(par.indexOf('=') + 1));
    const r = await cliente.callTool({ name: herramienta, arguments: argumentos });
    console.log(r.isError ? 'La herramienta devolvió un ERROR:' : 'Resultado:');
    for (const c of r.content ?? []) console.log(c.type === 'text' ? c.text : c);
  }
  console.log(`(${Date.now() - inicio} ms)`);
  await cliente.close();
} catch (error) {
  console.error('No fue posible:', error.message);
  process.exit(1);
}
