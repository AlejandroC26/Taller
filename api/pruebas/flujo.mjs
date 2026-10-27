// Prueba de punta a punta del lado manual: los agentes mueven la orden por el MCP y los
// mecánicos la trabajan por las mismas rutas REST que usa la web (tomar, diagnosticar con
// evidencias, remitir, reparar). En cada paso se revisan los permisos: lo ajeno da 404 y lo
// que no es del rol, 403. Requiere la API en marcha y TALLER_ADMIN_USUARIO / _CLAVE.
//
//   npm run flujo
import { randomUUID } from 'node:crypto';
import {
  cerrarClientes,
  cuenta,
  entrarAdmin,
  fallar,
  fallidas,
  gris,
  llamar,
  negrita,
  ordenDeCompra,
  PNG,
  prepararUsuarios,
  primeraFranja,
  revisar,
  rojo,
  verde,
} from './agentes.mjs';
import { BASE, pedir } from './comun.mjs';

const id = () => `flujo-${randomUUID()}`;
const como = (usuario, ruta, opciones = {}) => pedir(ruta, { ...opciones, token: cuenta(usuario).web });
const paso = (texto) => console.log(`\n${negrita(texto)}`);

// Sube una evidencia como lo hace la web: multipart con el campo «archivo».
async function subir(usuario, codigo, nombre, tipo, contenido, tareaId) {
  const formulario = new FormData();
  formulario.append('archivo', new Blob([contenido], { type: tipo }), nombre);
  if (tareaId) formulario.append('tareaId', String(tareaId));
  const r = await fetch(`${BASE}/api/ordenes/${codigo}/evidencias`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cuenta(usuario).web}` },
    body: formulario,
  });
  return { estado: r.status, json: await r.json().catch(() => null) };
}

try {
  await prepararUsuarios();
  const admin = await entrarAdmin();
  const sedes = (await pedir('/api/talleres', { token: admin })).json;
  const frenos = sedes.find((s) => s.codigo === 'PL-FRENOS');

  paso('1. Permisos generales');
  revisar((await pedir('/api/ordenes')).estado === 401, 'sin token: 401');
  revisar((await como('mec-centro', '/api/usuarios')).estado === 403, 'el mecánico no ve los usuarios: 403');
  const usuarios = await pedir('/api/usuarios', { token: admin });
  revisar(usuarios.estado === 200 && usuarios.json.find((u) => u.usuario === 'mec-frenos')?.taller?.codigo === 'PL-FRENOS', 'el administrador ve los usuarios con su sede');
  revisar((await como('agente-concesionario', '/api/usuarios')).estado === 403, 'un agente no administra usuarios: 403');

  paso('2. El concesionario agenda una revisión general (MCP)');
  const mensajes = ['Hace un ruido raro adelante, no sé qué es'];
  const pre = await llamar('agente-concesionario', 'prediagnosticar', { id_relacion: 'REL-1005', mensajes_cliente: mensajes });
  revisar(pre.ruta === 'revision_general' && pre.sede_sugerida?.codigo === 'PL-CENTRO', 'sin síntoma claro: revisión general en PL-CENTRO', pre);
  let orden = await llamar('agente-concesionario', 'agendar_cita', {
    id_relacion: 'REL-1005',
    taller: 'PL-CENTRO',
    fecha_hora: await primeraFranja('PL-CENTRO'),
    mensajes_cliente: mensajes,
    id_mensaje: id(),
  });
  const codigo = orden.codigo;
  console.log(gris(`    ${codigo}: ${orden.vehiculo.marca} ${orden.vehiculo.modelo} (${orden.vehiculo.placa})`));

  paso('3. Cola de la sede y lo ajeno (REST)');
  const enCola = async (u) => (await como(u, '/api/ordenes?vista=cola')).json.some((o) => o.codigo === codigo);
  revisar(await enCola('mec-centro'), 'aparece en la cola de PL-CENTRO');
  revisar(!(await enCola('mec-motor')), 'no aparece en la cola de PL-MOTOR');
  revisar((await como('mec-motor', `/api/ordenes/${codigo}`)).estado === 404, 'un mecánico de otra sede recibe 404 al consultarla');
  revisar((await como('mec-motor', `/api/ordenes/${codigo}/tomar`, { metodo: 'POST' })).estado === 404, '…y 404 al intentar tomarla');
  revisar((await como('agente-concesionario', `/api/ordenes/${codigo}`)).estado === 200, 'un agente ve cualquier orden');

  paso('4. Revisión general y remisión (REST, mec-centro)');
  let r = await como('mec-centro', `/api/ordenes/${codigo}/tomar`, { metodo: 'POST' });
  revisar(r.estado === 200 && r.json.estado === 'en_diagnostico', 'tomar → en_diagnostico', r.json);
  revisar((await como('mec-centro', `/api/ordenes/${codigo}/tomar`, { metodo: 'POST' })).estado === 409, 'tomarla otra vez: 409');
  r = await como('mec-centro', `/api/ordenes/${codigo}/remitir`, { metodo: 'POST', cuerpo: { taller: frenos.id, nota: 'Golpe en la suspensión delantera al pasar huecos' } });
  revisar(r.estado === 200 && r.json.estado === 'remitida' && r.json.sede.codigo === 'PL-FRENOS', 'remitida a PL-FRENOS', r.json);
  revisar(await enCola('mec-frenos'), 'ahora está en la cola de PL-FRENOS');

  paso('5. Diagnóstico del especialista con evidencia (REST, mec-frenos)');
  r = await como('mec-frenos', `/api/ordenes/${codigo}/tomar`, { metodo: 'POST' });
  revisar(r.json?.estado === 'en_diagnostico', 'el especialista la toma');
  const cuerpo = {
    observaciones: 'Prueba de punta a punta',
    tareas: [
      {
        sku: 'SUS-AMORT',
        descripcion: 'Amortiguador delantero con fuga de aceite',
        causa: 'defecto_fabrica',
        garantiaAplica: true,
        garantiaMotivo: 'Retén del amortiguador defectuoso',
        repuestos: [{ codigoRepuesto: 'AMO-DEL-GAS', cantidad: 2 }],
      },
    ],
  };
  revisar((await como('mec-motor', `/api/ordenes/${codigo}/diagnostico`, { metodo: 'PUT', cuerpo })).estado === 404, 'otro mecánico no puede diagnosticarla: 404');
  r = await como('mec-frenos', `/api/ordenes/${codigo}/diagnostico`, { metodo: 'PUT', cuerpo });
  const propio = r.json?.servicios?.find((s) => !s.fija);
  revisar(r.estado === 200 && propio?.precio > 0, `SKU con precio fijo (${propio?.precio})`, r.json);
  revisar(r.json?.servicios?.some((s) => s.fija && s.sku === 'REV-GENERAL'), 'lleva la revisión general ya hecha');
  r = await como('mec-frenos', `/api/ordenes/${codigo}/diagnostico/finalizar`, { metodo: 'POST' });
  revisar(r.estado === 400 && /evidencia/.test(r.json?.message), 'sin evidencia no se puede finalizar: 400', r.json);
  r = await subir('mec-frenos', codigo, 'nota.txt', 'text/plain', 'no es una foto', propio.id);
  revisar(r.estado === 400, 'un archivo que no es foto ni PDF: 400');
  r = await subir('mec-frenos', codigo, 'fuga.png', 'image/png', Buffer.from(PNG, 'base64'), propio.id);
  revisar(r.estado === 201, 'sube la foto de la evidencia', r.json);
  const evidencia = r.json;
  revisar((await como('mec-motor', `/api/evidencias/${evidencia.id}`)).estado === 404, 'otro mecánico no descarga la evidencia: 404');
  revisar((await como('agente-concesionario', `/api/evidencias/${evidencia.id}`)).estado === 200, 'el concesionario sí la descarga');
  r = await como('mec-frenos', `/api/ordenes/${codigo}/diagnostico/finalizar`, { metodo: 'POST' });
  revisar(r.estado === 200, 'finaliza el diagnóstico', r.json);

  paso('6. Garantía (concesionario) y cotización (facturación), por MCP');
  orden = await llamar('agente-concesionario', 'estado_orden', { codigo });
  if (orden.estado === 'validando_garantia') {
    console.log(gris(`    el concesionario no es el simulado: responda con  npm run simular -- garantia ${codigo} si|no  y vuelva a correr`));
    throw new Error('Se detuvo esperando al concesionario real');
  }
  const cot = await llamar('agente-facturacion', 'consultar_cotizacion', { codigo });
  revisar(JSON.stringify(cot.mano_obra.map((l) => l.sku)) === JSON.stringify(['REV-GENERAL', 'SUS-AMORT']), 'cobra la revisión general y la especialidad');
  revisar(cot.repuestos.length === 1 && !('precio' in cot.repuestos[0]), 'los repuestos van sin precio');
  console.log(gris(`    Telegram al cliente: «${cot.mensaje_garantia}»`));
  orden = await llamar('agente-facturacion', 'registrar_respuesta_cliente', {
    codigo,
    aceptada: true,
    referencia: `FAC-${codigo}`,
    orden_compra: ordenDeCompra(cot.repuestos),
    id_mensaje: id(),
  });
  revisar(orden.estado === 'aprobada', 'el cliente aceptó: aprobada');

  paso('7. Reparación (REST, mec-frenos)');
  r = await como('mec-frenos', `/api/ordenes/${codigo}/tomar`, { metodo: 'POST' });
  revisar(r.json?.estado === 'en_reparacion', 'toma la reparación');
  const ruta = `/api/ordenes/${codigo}/reparacion`;
  let rep = (await como('mec-frenos', ruta)).json;
  revisar(rep.orden_compra.length === 1 && rep.orden_compra[0].tienda, `ve la orden de compra (${rep.orden_compra[0]?.tienda})`);
  revisar((await como('mec-frenos', `${ruta}/terminar`, { metodo: 'POST' })).estado === 400, 'sin horas no puede terminar: 400');
  const hace = (h) => new Date(Date.now() - h * 3600_000).toISOString();
  revisar((await como('mec-frenos', `${ruta}/horas`, { metodo: 'POST', cuerpo: { inicio: hace(17), fin: hace(0) } })).estado === 400, 'un registro de 17 h: 400');
  r = await como('mec-frenos', `${ruta}/horas`, { metodo: 'POST', cuerpo: { inicio: hace(2), fin: hace(0), nota: 'Cambio de amortiguadores' } });
  revisar(r.estado === 201 && r.json.control.horas_reales === 2, 'registra 2 h de control', r.json?.control);
  const tarea = r.json.servicios.find((s) => !s.fija);
  r = await como('mec-frenos', `${ruta}/tareas/${tarea.id}`, { metodo: 'PATCH', cuerpo: { completada: true } });
  revisar(r.json?.servicios.find((s) => s.id === tarea.id)?.completada, 'marca el servicio hecho');
  const compra = r.json.orden_compra[0];
  r = await como('mec-frenos', `${ruta}/partes`, { metodo: 'POST', cuerpo: { codigoRepuesto: compra.codigo_repuesto, cantidad: compra.cantidad, compraId: compra.id } });
  revisar(r.json?.partes_usadas?.[0]?.tienda === compra.tienda, 'registra la parte usada desde la compra');
  revisar((await como('mec-motor', `${ruta}/terminar`, { metodo: 'POST' })).estado === 404, 'otro mecánico no puede terminarla: 404');
  r = await como('mec-frenos', `${ruta}/terminar`, { metodo: 'POST' });
  revisar(r.json?.estado_orden === 'pendiente_facturacion', 'termina: pendiente de facturación', r.json);
  rep = r.json;

  paso('8. Pago y salida (MCP)');
  await llamar('agente-facturacion', 'registrar_pago', { codigo, referencia_pse: `PSE-${Date.now()}`, valor: cot.total_mano_obra_cliente, id_mensaje: id() });
  orden = await llamar('agente-concesionario', 'registrar_salida', { codigo, id_mensaje: id() });
  revisar(orden.estado === 'entregada', 'facturada y entregada');
  revisar(!(await como('mec-frenos', '/api/ordenes?vista=mias')).json.some((o) => o.codigo === codigo && o.estado !== 'entregada'), 'ya no está abierta en Mis trabajos');
  console.log(gris(`    mano de obra realizada ${rep.mano_obra_realizada} de ${rep.mano_obra_cotizada} cotizada`));
} catch (error) {
  fallar();
  console.error(rojo(`\n${error.message}`));
} finally {
  await cerrarClientes();
}
console.log(fallidas() ? rojo(`\n${fallidas()} verificación(es) fallaron.`) : verde('\nEl flujo manual pasó completo.'));
process.exit(fallidas() ? 1 : 0);
