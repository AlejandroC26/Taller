// Prueba de carga por MCP: N órdenes de punta a punta, P a la vez, como lo haría un orquestador.
// Cada trabajador usa un id_relacion distinto (el taller no permite dos órdenes abiertas para el
// mismo), así que P va de 1 a 8. Requiere la API en marcha y el concesionario simulado.
//
//   npm run carga                   30 órdenes, 6 a la vez
//   npm run carga -- 60 8           60 órdenes, 8 a la vez
// Deja cada paso en resultados/carga.csv (o carga-<N>-<P>.csv si no es la corrida de 30 y 6).
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cerrarClientes,
  deLaTienda,
  despejarRelacion,
  facturacionReal,
  llamar,
  MECANICO_DE,
  ordenDeCompra,
  prepararUsuarios,
} from './agentes.mjs';
import { CARPETA } from './comun.mjs';

const total = Number(process.argv[2] ?? 30);
const paralelo = Math.min(8, Math.max(1, Number(process.argv[3] ?? 6)));
const RELACIONES = ['REL-1001', 'REL-1002', 'REL-1003', 'REL-1004', 'REL-1005', 'REL-1006', 'REL-1007', 'REL-1008'];
// Cada sede atiende una cita por hora: los trabajadores se reparten entre dos sedes especializadas.
const PERFILES = [
  {
    sede: 'PL-FRENOS',
    mensajes: ['Me chilla al frenar y siento las pastillas gastadas'],
    servicio: { sku: 'FRE-PASTILLAS', causa: 'desgaste_normal', garantia_motivo: 'Desgaste normal por uso', repuestos: [{ codigo_repuesto: 'PAS-DEL-CER', cantidad: 1 }] },
  },
  {
    sede: 'PL-MOTOR',
    mensajes: ['Se prendió el check engine y el carro jalonea'],
    servicio: { sku: 'MOT-DIAG', causa: 'desgaste_normal', garantia_motivo: 'Sensor desgastado por uso', repuestos: [{ codigo_repuesto: 'SEN-OXI-STD', cantidad: 1 }] },
  },
];
const mostrar = { mostrar: false };

const pasos = [];
let franjasLlenas = 0;
// Mide un paso de una orden. Si falla, la orden se corta y queda el error.
async function medir(orden, paso, fn) {
  const inicio = performance.now();
  try {
    const r = await fn();
    pasos.push({ orden, paso, ms: Math.round(performance.now() - inicio), ok: true, error: '' });
    return r;
  } catch (error) {
    pasos.push({ orden, paso, ms: Math.round(performance.now() - inicio), ok: false, error: error.message });
    throw error;
  }
}

async function unaOrden(n, idRelacion, { sede: SEDE, mensajes: MENSAJES, servicio: SERVICIO }) {
  const id = () => `carga-${n}-${randomUUID()}`;
  const mecanico = MECANICO_DE[SEDE];
  await despejarRelacion(idRelacion);
  const pre = await medir(n, 'prediagnosticar', () =>
    llamar('agente-concesionario', 'prediagnosticar', { id_relacion: idRelacion, mensajes_cliente: MENSAJES, id_mensaje: id() }, mostrar));
  const codigo = await medir(n, 'agendar_cita', async () => {
    const desde = new Date(Date.now() - 5 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
    const { franjas } = await llamar('agente-concesionario', 'consultar_disponibilidad', { taller: SEDE, desde }, mostrar);
    // Varios trabajadores piden la misma franja a la vez: si otro la llenó, se prueba la siguiente,
    // como lo indica el mensaje del taller.
    let reserva;
    for (const franja of franjas) {
      try {
        reserva = await llamar('agente-concesionario', 'reservar_franja', { taller: SEDE, fecha_hora: franja.inicio, id_relacion: idRelacion, id_mensaje: id() }, mostrar);
        break;
      } catch (error) {
        if (!/llena/i.test(error.message)) throw error;
        franjasLlenas++;
      }
    }
    if (!reserva) throw new Error(`No quedó ninguna franja libre en ${SEDE}`);
    const orden = await llamar('agente-concesionario', 'agendar_cita', {
      id_relacion: idRelacion, id_prediagnostico: pre.id_prediagnostico, id_reserva: reserva.id_reserva, taller: SEDE, id_mensaje: id(),
    }, mostrar);
    return orden.codigo;
  });
  await medir(n, 'tomar_orden', () => llamar(mecanico, 'tomar_orden', { codigo, id_mensaje: id() }, mostrar));
  await medir(n, 'diagnosticar', async () => {
    const servicios = await deLaTienda(mecanico, codigo, [SERVICIO]);
    await llamar(mecanico, 'registrar_diagnostico', { codigo, observaciones: 'Carga', servicios }, mostrar);
    await llamar(mecanico, 'finalizar_diagnostico', { codigo, id_mensaje: id() }, mostrar);
  });
  const cot = await medir(n, 'cotizar_y_aprobar', async () => {
    const c = await llamar('agente-facturacion', 'consultar_cotizacion', { codigo }, mostrar);
    await llamar('agente-facturacion', 'registrar_respuesta_cliente', {
      codigo, aceptada: true, referencia: `FAC-${codigo}`, orden_compra: ordenDeCompra(c.repuestos), id_mensaje: id(),
    }, mostrar);
    return c;
  });
  await medir(n, 'reparar', async () => {
    let rep = await llamar(mecanico, 'tomar_orden', { codigo, id_mensaje: id() }, mostrar);
    rep = await llamar(mecanico, 'registrar_horas', { codigo, inicio: new Date(Date.now() - 3600_000).toISOString(), fin: new Date().toISOString(), nota: 'Carga' }, mostrar);
    for (const s of rep.servicios.filter((x) => !x.fija)) rep = await llamar(mecanico, 'marcar_tarea', { codigo, tarea_id: s.id, completada: true }, mostrar);
    for (const c of rep.orden_compra) rep = await llamar(mecanico, 'registrar_parte_usada', { codigo, codigo_repuesto: c.codigo_repuesto, cantidad: c.cantidad, compra_id: c.id }, mostrar);
    await llamar(mecanico, 'terminar_reparacion', { codigo, id_mensaje: id() }, mostrar);
  });
  await medir(n, 'pago_y_salida', async () => {
    await llamar('agente-facturacion', 'registrar_pago', { codigo, referencia_pse: `PSE-${randomUUID()}`, valor: cot.total_mano_obra_cliente, id_mensaje: id() }, mostrar);
    const o = await llamar('agente-concesionario', 'registrar_salida', { codigo, id_mensaje: id() }, mostrar);
    if (o.estado !== 'entregada') throw new Error(`${codigo} quedó ${o.estado}`);
  });
}

await prepararUsuarios();
if (await facturacionReal()) {
  console.error('Facturación real configurada (MCP_FACTURACION_URL): la carga respondería por el cliente. Quite la variable y repita.');
  process.exit(1);
}

console.log(`${total} órdenes, ${paralelo} a la vez, sedes ${PERFILES.map((p) => p.sede).join(' y ')}`);
let siguiente = 0;
let completas = 0;
const errores = [];
const inicio = performance.now();
// Cada trabajador toma la siguiente orden pendiente con su propio id_relacion.
await Promise.all(Array.from({ length: paralelo }, async (_, t) => {
  while (siguiente < total) {
    const n = ++siguiente;
    try {
      await unaOrden(n, RELACIONES[t], PERFILES[t % PERFILES.length]);
      completas++;
    } catch (error) {
      errores.push(`orden ${n}: ${error.message}`);
    }
  }
}));
const segundos = (performance.now() - inicio) / 1000;
await cerrarClientes();

const percentil = (lista, p) => lista[Math.min(lista.length - 1, Math.ceil((p / 100) * lista.length) - 1)];
console.log(`${completas} completas, ${errores.length} con error, ${segundos.toFixed(1)} s, ${Math.round((completas / segundos) * 60)} órdenes por minuto`);
console.log(`Franjas que otro trabajador llenó primero (se tomó la siguiente): ${franjasLlenas}`);
console.log('Paso                    p50 ms  p95 ms  máx ms');
for (const paso of [...new Set(pasos.map((p) => p.paso))]) {
  const ms = pasos.filter((p) => p.paso === paso && p.ok).map((p) => p.ms).sort((a, b) => a - b);
  if (ms.length) console.log(`${paso.padEnd(22)} ${String(percentil(ms, 50)).padStart(7)} ${String(percentil(ms, 95)).padStart(7)} ${String(ms.at(-1)).padStart(7)}`);
}
for (const e of errores.slice(0, 5)) console.log(`  ${e}`);

const carpeta = join(CARPETA, '..', 'resultados');
mkdirSync(carpeta, { recursive: true });
const nombre = total === 30 && paralelo === 6 ? 'carga.csv' : `carga-${total}-${paralelo}.csv`;
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
writeFileSync(join(carpeta, nombre), [
  'orden;paso;ms;resultado;error',
  ...pasos.map((p) => [p.orden, p.paso, p.ms, p.ok ? 'OK' : 'ERROR', p.error].map(csv).join(';')),
].join('\n'));
console.log(`Detalle en resultados/${nombre}`);
process.exit(errores.length ? 1 : 0);
