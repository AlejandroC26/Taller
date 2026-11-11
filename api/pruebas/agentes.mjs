// Lo que comparten simular.mjs y flujo.mjs: los usuarios de prueba (agentes y un mecánico
// por sede), sus clientes MCP y la presentación de los resultados.
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, CARPETA, pedir } from './comun.mjs';

// ---------- Presentación ----------
export const gris = (t) => `\x1b[90m${t}\x1b[0m`;
export const verde = (t) => `\x1b[32m${t}\x1b[0m`;
export const rojo = (t) => `\x1b[31m${t}\x1b[0m`;
export const negrita = (t) => `\x1b[1m${t}\x1b[0m`;
export const pesos = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
let fallas = 0;
// Cada verificación queda registrada con su sección (el caso o el paso) para el CSV de conformidad.
const registro = [];
let seccionActual = '';
export const seccion = (nombre) => {
  seccionActual = nombre;
};
export const fallidas = () => fallas;
export const fallar = (texto) => {
  fallas++;
  if (texto) registro.push({ seccion: seccionActual, texto, ok: false, detalle: '' });
};
export const revisar = (condicion, texto, detalle) => {
  registro.push({ seccion: seccionActual, texto, ok: Boolean(condicion), detalle: condicion || !detalle ? '' : JSON.stringify(detalle) });
  if (condicion) console.log(`    ${verde('✓')} ${texto}`);
  else {
    fallas++;
    console.log(`    ${rojo('✗')} ${texto}${detalle ? gris(`  ${JSON.stringify(detalle)}`) : ''}`);
  }
};
// Escribe las verificaciones en resultados/<archivo> (separado por punto y coma, como lo abre Excel en español).
export function guardarResultados(archivo) {
  const carpeta = join(CARPETA, '..', 'resultados');
  mkdirSync(carpeta, { recursive: true });
  const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const filas = registro.map((r) => [r.seccion, r.texto, r.ok ? 'OK' : 'FALLA', r.detalle].map(csv).join(';'));
  writeFileSync(join(carpeta, archivo), ['seccion;verificacion;resultado;detalle', ...filas].join('\n'));
  const ok = registro.filter((r) => r.ok).length;
  console.log(gris(`Resultados: ${ok} de ${registro.length} verificaciones correctas en resultados/${archivo}`));
}

// ---------- Usuarios y tokens (se crean una vez y se guardan en .usuarios-simulacion.json) ----------
const ARCHIVO = join(CARPETA, '.usuarios-simulacion.json');
const USUARIOS = {
  'agente-concesionario': { rol: 'agente', nombre: 'Agente', apellido: 'Concesionario' },
  'agente-facturacion': { rol: 'agente', nombre: 'Agente', apellido: 'Facturación' },
  'mec-centro': { rol: 'mecanico', nombre: 'Mario', apellido: 'Centro', sede: 'PL-CENTRO' },
  'mec-frenos': { rol: 'mecanico', nombre: 'Nora', apellido: 'Frenos', sede: 'PL-FRENOS' },
  'mec-motor': { rol: 'mecanico', nombre: 'Óscar', apellido: 'Motor', sede: 'PL-MOTOR' },
};
export const MECANICO_DE = { 'PL-CENTRO': 'mec-centro', 'PL-FRENOS': 'mec-frenos', 'PL-MOTOR': 'mec-motor' };

let cuentas = {};
// El token web y el id de un usuario de prueba (para las pruebas por REST).
export const cuenta = (usuario) => cuentas[usuario];

export async function prepararUsuarios() {
  const guardado = existsSync(ARCHIVO) ? JSON.parse(readFileSync(ARCHIVO, 'utf8')) : {};
  // Si los tokens guardados siguen sirviendo, no se inicia sesión otra vez (el límite es de 10 por minuto).
  const vigentes = await Promise.all(
    Object.keys(USUARIOS).map(async (u) => guardado[u]?.web && (await pedir('/api/auth/yo', { token: guardado[u].web })).estado === 200),
  );
  if (vigentes.every(Boolean) && Object.keys(USUARIOS).every((u) => guardado[u]?.mcp)) return (cuentas = guardado);

  const admin = await entrarAdmin();
  const sedes = (await pedir('/api/talleres', { token: admin })).json;
  for (const [usuario, datos] of Object.entries(USUARIOS)) {
    if (!guardado[usuario]?.clave) {
      const clave = `Sim-${randomBytes(9).toString('base64url')}`;
      const r = await pedir('/api/usuarios', {
        metodo: 'POST',
        token: admin,
        cuerpo: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          documento: `7${randomBytes(4).readUInt32BE() % 1e9}`.padEnd(10, '0'),
          telefono: '3000000000',
          usuario,
          clave,
          rol: datos.rol,
          tallerId: datos.sede ? sedes.find((s) => s.codigo === datos.sede)?.id : null,
        },
      });
      if (r.estado === 409) throw new Error(`${usuario} ya existe con otra clave: borre la línea en ${ARCHIVO} o cambie su clave`);
      if (r.estado !== 201) throw new Error(`No se pudo crear ${usuario}: ${r.json?.message}`);
      guardado[usuario] = { clave, id: r.json.id };
    }
    const entrar = await pedir('/api/auth/entrar', { metodo: 'POST', cuerpo: { usuario, clave: guardado[usuario].clave } });
    if (entrar.estado !== 200) throw new Error(`${usuario} no pudo entrar: ${entrar.json?.message}`);
    guardado[usuario].id = entrar.json.usuario.id;
    guardado[usuario].web = entrar.json.token;
    guardado[usuario].mcp = (await pedir('/api/auth/token-mcp', { metodo: 'POST', token: entrar.json.token })).json.token;
  }
  writeFileSync(ARCHIVO, JSON.stringify(guardado, null, 2));
  return (cuentas = guardado);
}

// El token del administrador. Se guarda junto a los de los agentes para no gastar inicios
// de sesión en cada corrida.
export async function entrarAdmin() {
  const guardado = existsSync(ARCHIVO) ? JSON.parse(readFileSync(ARCHIVO, 'utf8')) : {};
  if (guardado.admin && (await pedir('/api/auth/yo', { token: guardado.admin })).estado === 200) return guardado.admin;
  const r = await pedir('/api/auth/entrar', {
    metodo: 'POST',
    cuerpo: { usuario: process.env.TALLER_ADMIN_USUARIO, clave: process.env.TALLER_ADMIN_CLAVE },
  });
  if (r.estado !== 200) throw new Error(`El administrador no pudo entrar: ${r.json?.message ?? r.estado}. Revise TALLER_ADMIN_USUARIO y TALLER_ADMIN_CLAVE`);
  writeFileSync(ARCHIVO, JSON.stringify({ ...guardado, admin: r.json.token }, null, 2));
  return r.json.token;
}

// ---------- Clientes MCP ----------
const clientes = {};
export async function mcp(usuario) {
  if (clientes[usuario]) return clientes[usuario];
  const cliente = new Client({ name: `simulador-${usuario}`, version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  await cliente.connect(
    new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${cuentas[usuario].mcp}` } } }),
  );
  return (clientes[usuario] = cliente);
}
export const cerrarClientes = async () => {
  for (const c of Object.values(clientes)) await c.close().catch(() => {});
};

// Llama una herramienta y muestra quién la llamó. Un error de negocio corta el caso.
export async function llamar(usuario, herramienta, argumentos = {}, { mostrar = true } = {}) {
  const r = await (await mcp(usuario)).callTool({ name: herramienta, arguments: argumentos });
  const texto = r.content?.[0]?.text ?? '';
  if (r.isError) throw new Error(`${herramienta}: ${texto}`);
  const datos = r.structuredContent ?? JSON.parse(texto);
  if (mostrar) {
    const estado = datos.estado ? ` → ${negrita(datos.estado)}` : '';
    console.log(`  ${gris(usuario.padEnd(21))} ${herramienta}${estado}`);
  }
  return datos;
}

// ---------- Datos de apoyo ----------
// Una foto PNG de 1×1: la evidencia de prueba.
export const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
// Precios de las tiendas simuladas que consulta facturación.
const TIENDAS = [
  { tienda: 'Repuestos El Cóndor', factor: 1 },
  { tienda: 'AutoPartes La 68', factor: 0.93 },
];
const PRECIO_BASE = {
  'PAS-DEL-CER': 185000, 'PAS-TRA-CER': 160000, 'DIS-DEL-VENT': 240000, 'LIQ-FRE-DOT4': 32000, 'AMO-DEL-GAS': 310000,
  'AMO-TRA-GAS': 280000, 'BUJ-IRI-STD': 48000, 'BOB-ENC-STD': 210000, 'BAT-12V-60AH': 480000, 'ALT-90A-STD': 690000,
  'KIT-EMB-STD': 890000, 'SEN-OXI-STD': 260000, 'ACE-5W30-1L': 42000, 'FIL-ACE-STD': 28000, 'FIL-AIRE-STD': 45000,
};
export const mejorPrecio = (codigo) => {
  const base = PRECIO_BASE[codigo] ?? 100000;
  return TIENDAS.map((t) => ({ tienda: t.tienda, precio: Math.round(base * t.factor) })).sort((a, b) => a.precio - b.precio)[0];
};
// La orden de compra que arma facturación con las tiendas, a partir de la cotización.
export const ordenDeCompra = (repuestos) =>
  repuestos.map((r) => {
    const { tienda, precio } = mejorPrecio(r.codigo_repuesto);
    return { codigo_repuesto: r.codigo_repuesto, cantidad: r.cantidad, tienda, precio_unitario: precio };
  });

// El mecánico elige los repuestos del catálogo de la tienda (la simulada si no hay
// MCP_TIENDA_1_URL): cada código del caso se busca antes de usarlo, como en la web.
export async function deLaTienda(usuario, codigo, servicios) {
  const elegidos = [];
  for (const s of servicios) {
    const repuestos = [];
    for (const r of s.repuestos ?? []) {
      const { repuestos: hallados } = await llamar(usuario, 'buscar_repuestos_tienda', { codigo, texto: r.codigo_repuesto }, { mostrar: false });
      if (!hallados.some((h) => h.codigo_repuesto === r.codigo_repuesto)) throw new Error(`La tienda no tiene ${r.codigo_repuesto} en su catálogo`);
      repuestos.push({ codigo_repuesto: r.codigo_repuesto, cantidad: r.cantidad });
    }
    elegidos.push({ ...s, repuestos });
  }
  return elegidos;
}

// Con facturación real configurada (MCP_FACTURACION_URL), la respuesta del cliente la da
// facturación por Telegram: el simulador no debe responder por ella.
export async function facturacionReal() {
  const { destinos } = await llamar('agente-concesionario', 'consultar_bandeja', {}, { mostrar: false });
  return destinos.some((d) => d.destino === 'facturacion' && d.configurado);
}

// El taller no permite dos órdenes abiertas para el mismo id_relacion, y una prueba a mano
// (o una corrida cortada) puede haber dejado una a medias: se cierra antes de agendar.
export async function despejarRelacion(idRelacion) {
  const { elementos } = await llamar('agente-concesionario', 'listar_ordenes', { id_relacion: idRelacion, abiertas: true }, { mostrar: false });
  const nota = 'Cierre del simulador: orden abierta de una prueba anterior';
  for (const o of elementos) {
    let estado = o.estado;
    if (estado === 'en_reparacion') {
      throw new Error(`${o.codigo} (${idRelacion}) sigue en reparación: termínela en la web o por MCP antes de simular con esa relación`);
    }
    if (estado === 'pendiente_facturacion') {
      estado = (await llamar('agente-facturacion', 'registrar_pago', { codigo: o.codigo, referencia_pse: `PSE-CIERRE-${Date.now()}`, valor: 0 }, { mostrar: false })).estado;
    }
    if (estado === 'facturada' || estado === 'rechazada') await llamar('agente-concesionario', 'registrar_salida', { codigo: o.codigo, nota }, { mostrar: false });
    else await llamar('agente-concesionario', 'cancelar_cita', { codigo: o.codigo, motivo: nota }, { mostrar: false });
    console.log(gris(`    ${o.codigo} de ${idRelacion} seguía abierta (${o.estado}): se cerró`));
  }
}

// Primera franja libre de una sede desde mañana.
export async function primeraFranja(sede) {
  for (let d = 1; d <= 14; d++) {
    const fecha = new Date(Date.now() - 5 * 3600_000 + d * 86_400_000).toISOString().slice(0, 10);
    const r = await llamar('agente-concesionario', 'consultar_disponibilidad', { taller: sede, fecha }, { mostrar: false });
    const libre = r.franjas.find((f) => f.libres > 0);
    if (libre) return libre.inicio;
  }
  throw new Error(`La sede ${sede} no tiene franjas libres en dos semanas`);
}
