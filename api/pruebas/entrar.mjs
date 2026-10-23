// Inicia sesión y guarda dos tokens: uno para la API (web) y otro para el servidor MCP.
//   node pruebas/entrar.mjs <usuario> <clave>
import { guardarToken, pedir } from './comun.mjs';

const [usuario, clave] = process.argv.slice(2);
if (!usuario || !clave) {
  console.error('Uso: node pruebas/entrar.mjs <usuario> <clave>');
  process.exit(1);
}
const r = await pedir('/api/auth/entrar', { metodo: 'POST', cuerpo: { usuario, clave } });
if (r.estado !== 200) {
  console.error(`HTTP ${r.estado}: ${r.json?.message ?? r.texto}`);
  process.exit(1);
}
guardarToken('web', r.json.token);
const mcp = await pedir('/api/auth/token-mcp', { metodo: 'POST', token: r.json.token });
guardarToken('mcp', mcp.json.token);
console.log(`Sesión iniciada: ${r.json.usuario.nombre} ${r.json.usuario.apellido} (${r.json.usuario.rol}).`);
console.log('Tokens guardados en pruebas/.token-web (8 horas) y pruebas/.token-mcp (7 días).');
