// Simulador de los agentes: hace de concesionario, de facturación y de mecánicos, todo por
// el MCP del taller, como lo haría un orquestador (sigue siguiente_paso y
// acciones_disponibles). Requiere la API en marcha.
//
//   npm run simular -- todos                      todos los casos
//   npm run simular -- defecto-fabrica            un caso (ver CASOS abajo)
//   npm run simular -- casos                      lista los casos
//   npm run simular -- agendar REL-1001 [PL-FRENOS] "chilla al frenar"
//   npm run simular -- estado OT-0001
//   npm run simular -- garantia OT-0001 si|no     respuesta del concesionario (si no es el simulado)
//   npm run simular -- facturacion-aceptar OT-0001
//   npm run simular -- facturacion-rechazar OT-0001
//   npm run simular -- pago OT-0001
//   npm run simular -- salida OT-0001
//   npm run simular -- herramientas [agente|mecanico]
import { randomUUID } from 'node:crypto';
import {
  cerrarClientes,
  fallar,
  fallidas,
  gris,
  llamar,
  MECANICO_DE,
  mcp,
  negrita,
  ordenDeCompra,
  pesos,
  PNG,
  prepararUsuarios,
  primeraFranja,
  revisar,
  rojo,
  verde,
} from './agentes.mjs';

// ---------- Casos ----------
// servicios: lo que el mecánico especialista diagnostica. remitir: la sede a la que pasa la
// revisión general. esperado: lo que se verifica al final.
const CASOS = {
  'defecto-fabrica': {
    descripcion: 'Viene por garantía; el mecánico dictamina defecto de fábrica y el concesionario la valida. Paga el fabricante.',
    idRelacion: 'REL-1001',
    mensajes: ['Desde la semana pasada el carro chilla al frenar', 'Las pastillas se gastaron muy rápido, el carro tiene un año'],
    porGarantia: true,
    motivoReclamo: 'Desgaste prematuro de pastillas con 18.000 km',
    servicios: [{ sku: 'FRE-PASTILLAS', causa: 'defecto_fabrica', garantia_motivo: 'Compuesto de las pastillas de fábrica cristalizado a los 18.000 km', repuestos: [{ codigo_repuesto: 'PAS-DEL-CER', cantidad: 1 }] }],
    esperado: { valida: [true], pagador: ['fabricante'] },
  },
  'mala-instalacion': {
    descripcion: 'Una pieza mal instalada por un taller: el mecánico dice que aplica y se valida. Paga el taller.',
    idRelacion: 'REL-1002',
    mensajes: ['El pedal vibra al frenar desde que me cambiaron los discos en otro taller'],
    porGarantia: true,
    motivoReclamo: 'Vibración después de un cambio de discos',
    servicios: [{ sku: 'FRE-DISCOS', causa: 'mala_instalacion_taller', garantia_motivo: 'Disco montado sin limpiar el buje: alabeo por mala instalación', repuestos: [{ codigo_repuesto: 'DIS-DEL-VENT', cantidad: 2 }] }],
    esperado: { valida: [true], pagador: ['taller'] },
  },
  'manipulacion-cliente': {
    descripcion: 'Viene por garantía pero el mecánico encuentra manipulación del cliente (con evidencia): no aplica y paga el cliente.',
    idRelacion: 'REL-1006',
    mensajes: ['El motor tiembla y tiene falla en ralentí', 'Le pusieron unas bujías de competencia pero eso no debería afectar'],
    porGarantia: true,
    motivoReclamo: 'Falla de encendido en vehículo nuevo',
    servicios: [{ sku: 'MOT-BUJIAS', causa: 'manipulacion_cliente', garantia_aplica: false, garantia_motivo: 'Bujías no homologadas y cableado de bobinas empalmado por el cliente', repuestos: [{ codigo_repuesto: 'BUJ-IRI-STD', cantidad: 4 }, { codigo_repuesto: 'BOB-ENC-STD', cantidad: 1 }] }],
    esperado: { valida: [false], pagador: ['cliente'], motivo: /Manipulación del cliente/ },
  },
  'repuesto-defectuoso': {
    descripcion: 'La batería instalada salió defectuosa: aplica y se valida. Paga la tienda.',
    idRelacion: 'REL-1008',
    mensajes: ['El carro no prende en las mañanas', 'La batería se cambió hace dos meses'],
    porGarantia: true,
    motivoReclamo: 'Batería nueva que no retiene carga',
    servicios: [{ sku: 'ELE-BATERIA', causa: 'repuesto_defectuoso', garantia_motivo: 'Celda en corto en la batería instalada hace dos meses', repuestos: [{ codigo_repuesto: 'BAT-12V-60AH', cantidad: 1 }] }],
    esperado: { valida: [true], pagador: ['tienda'] },
  },
  'fuera-de-vigencia': {
    descripcion: 'El mecánico dice que aplica, pero el vehículo superó 3 años / 60.000 km: el concesionario la niega.',
    idRelacion: 'REL-1004',
    mensajes: ['Chilla al frenar y las pastillas son originales'],
    porGarantia: true,
    motivoReclamo: 'Pastillas originales defectuosas',
    servicios: [{ sku: 'FRE-PASTILLAS', causa: 'defecto_fabrica', garantia_motivo: 'Pastillas originales con desprendimiento del material', repuestos: [{ codigo_repuesto: 'PAS-DEL-CER', cantidad: 1 }] }],
    esperado: { valida: [false], pagador: ['cliente'], motivo: /venció|km/ },
  },
  desgaste: {
    descripcion: 'No viene por garantía: se consulta igual y el concesionario responde que el desgaste no lo cubre.',
    idRelacion: 'REL-1007',
    mensajes: ['Toca cambiar las pastillas, ya chilla al frenar'],
    servicios: [{ sku: 'FRE-PASTILLAS', causa: 'desgaste_normal', garantia_motivo: 'Desgaste normal por uso (22.800 km)', repuestos: [{ codigo_repuesto: 'PAS-DEL-CER', cantidad: 1 }] }],
    esperado: { valida: [false], pagador: ['cliente'], motivo: /Desgaste normal/ },
  },
  'garantia-no-reclamada': {
    descripcion: 'El cliente no reclamó garantía, pero el vehículo la tiene vigente y el mecánico encuentra un defecto de fábrica: se le avisa que va por garantía.',
    idRelacion: 'REL-1003',
    mensajes: ['Se prendió el check engine y el carro pierde fuerza en subida'],
    servicios: [{ sku: 'MOT-DIAG', causa: 'defecto_fabrica', garantia_motivo: 'Sensor de oxígeno de fábrica con lectura fuera de rango', repuestos: [{ codigo_repuesto: 'SEN-OXI-STD', cantidad: 1 }] }],
    esperado: { valida: [true], pagador: ['fabricante'], mensaje: /Va por garantía/ },
  },
  'solo-mano-obra': {
    descripcion: 'Sin repuestos que comprar: a facturación va solo la mano de obra.',
    idRelacion: 'REL-1002',
    mensajes: ['El carro se va hacia un lado y el timón vibra en carretera, necesito alineación'],
    servicios: [{ sku: 'SUS-ALINEA', causa: 'desgaste_normal', garantia_motivo: 'Desalineación por uso normal', repuestos: [] }],
    esperado: { valida: [false], pagador: ['cliente'], sinRepuestos: true },
  },
  'prediagnostico-claro': {
    descripcion: 'El cliente describe una falla clara: el prediagnóstico la envía directo a la sede especialista.',
    idRelacion: 'REL-1008',
    mensajes: ['Cuando voy a frenar el carro chilla mucho y siento las pastillas gastadas'],
    servicios: [{ sku: 'FRE-PASTILLAS', causa: 'desgaste_normal', garantia_motivo: 'Desgaste normal', repuestos: [{ codigo_repuesto: 'PAS-DEL-CER', cantidad: 1 }] }],
    esperado: { ruta: 'especializada', sede: 'PL-FRENOS', valida: [false], pagador: ['cliente'] },
  },
  'revision-general': {
    descripcion: 'El cliente no sabe qué tiene: revisión general en mantenimiento, se remite al especialista y se cobra la revisión más la especialidad.',
    idRelacion: 'REL-1005',
    mensajes: ['Hace un ruido raro, no sé qué es'],
    remitir: { taller: 'PL-FRENOS', nota: 'En la revisión general se escucha golpe en la suspensión delantera al pasar huecos' },
    servicios: [{ sku: 'SUS-AMORT', causa: 'desgaste_normal', garantia_motivo: 'Amortiguadores delanteros vencidos por uso (98.000 km)', repuestos: [{ codigo_repuesto: 'AMO-DEL-GAS', cantidad: 2 }] }],
    esperado: { ruta: 'revision_general', sede: 'PL-CENTRO', valida: [false], pagador: ['cliente'], skus: ['REV-GENERAL', 'SUS-AMORT'] },
  },
  'rechazo-cliente': {
    descripcion: 'El cliente rechaza la cotización por Telegram: el vehículo sale sin reparar.',
    idRelacion: 'REL-1007',
    mensajes: ['El pedal vibra al frenar en bajadas'],
    servicios: [{ sku: 'FRE-DISCOS', causa: 'desgaste_normal', garantia_motivo: 'Discos por debajo del espesor mínimo por uso', repuestos: [{ codigo_repuesto: 'DIS-DEL-VENT', cantidad: 2 }] }],
    rechazar: true,
    esperado: { valida: [false], pagador: ['cliente'], final: 'entregada' },
  },
};

async function correrCaso(nombre) {
  const c = CASOS[nombre];
  console.log(`\n${negrita(`■ ${nombre}`)} ${gris(c.descripcion)}`);
  const id = () => `${nombre}-${randomUUID()}`;

  // 1. El concesionario pide el prediagnóstico con lo que contó el cliente.
  const pre = await llamar('agente-concesionario', 'prediagnosticar', { id_relacion: c.idRelacion, mensajes_cliente: c.mensajes });
  console.log(gris(`    prediagnóstico (${pre.fuente}): ${pre.especialidad}, confianza ${pre.confianza}, ruta ${pre.ruta} → ${pre.sede_sugerida?.nombre}`));
  let sede = pre.sede_sugerida?.codigo;
  if (c.esperado.sede) {
    revisar(pre.ruta === c.esperado.ruta && sede === c.esperado.sede, `prediagnóstico: ruta ${c.esperado.ruta} a ${c.esperado.sede}`, { ruta: pre.ruta, sede });
    if (sede !== c.esperado.sede) sede = c.esperado.sede;
  }

  // 2. Agenda la cita en la primera franja libre de esa sede.
  const fechaHora = await primeraFranja(sede);
  let orden = await llamar('agente-concesionario', 'agendar_cita', {
    id_relacion: c.idRelacion,
    fecha_hora: fechaHora,
    taller: sede,
    mensajes_cliente: c.mensajes,
    por_garantia: c.porGarantia ?? false,
    ...(c.motivoReclamo ? { motivo_reclamo: c.motivoReclamo } : {}),
    id_mensaje: id(),
  });
  const codigo = orden.codigo;
  console.log(gris(`    ${codigo}: ${orden.vehiculo.marca} ${orden.vehiculo.modelo} de ${orden.cliente.nombre}, cita ${fechaHora}, garantía del vehículo ${orden.garantia.vigente ? 'vigente' : 'no vigente'}`));
  revisar(orden.siguiente_paso.responsable === 'mecanico' && orden.acciones_disponibles.includes('tomar_orden'), 'la orden dice que sigue el mecánico (tomar_orden)');

  // 3. Llega el carro: un mecánico de la sede la toma.
  let mecanico = MECANICO_DE[sede];
  orden = await llamar(mecanico, 'tomar_orden', { codigo, id_mensaje: id() });

  // 4. Revisión general y remisión al especialista, si aplica.
  if (c.remitir) {
    orden = await llamar(mecanico, 'remitir_orden', { codigo, ...c.remitir, id_mensaje: id() });
    revisar(orden.sede.codigo === c.remitir.taller, `remitida a ${c.remitir.taller}`);
    mecanico = MECANICO_DE[c.remitir.taller];
    orden = await llamar(mecanico, 'tomar_orden', { codigo, id_mensaje: id() });
  }

  // 5. Diagnóstico: servicios (SKU), causa, dictamen y repuestos; evidencias si hacen falta.
  let diag = await llamar(mecanico, 'registrar_diagnostico', { codigo, observaciones: 'Simulación', servicios: c.servicios });
  const propios = diag.servicios.filter((s) => !s.fija);
  for (const s of propios) {
    if (s.garantia.aplica) await llamar(mecanico, 'adjuntar_evidencia', { codigo, nombre: `${s.sku}.png`, contenido_base64: PNG, tarea_id: s.id });
  }
  if (c.porGarantia) await llamar(mecanico, 'adjuntar_evidencia', { codigo, nombre: 'evidencia-general.png', contenido_base64: PNG });
  diag = await llamar(mecanico, 'finalizar_diagnostico', { codigo, id_mensaje: id() });

  // 6. Con el concesionario simulado, la garantía ya está respondida; con uno real, se espera.
  orden = await llamar('agente-concesionario', 'estado_orden', { codigo }, { mostrar: false });
  if (orden.estado === 'validando_garantia') {
    console.log(gris('    el concesionario no es el simulado: responda con  npm run simular -- garantia ' + codigo + ' si|no'));
    return;
  }
  diag = await llamar('agente-concesionario', 'consultar_diagnostico', { codigo }, { mostrar: false });
  for (const s of diag.servicios) {
    console.log(gris(`    garantía ${s.sku}: ${s.garantia.valida ? 'VÁLIDA' : 'no válida'} — ${s.garantia.respuesta} (paga ${s.garantia.pagador})`));
  }
  const propiosFinal = diag.servicios.filter((s) => !s.fija);
  revisar(JSON.stringify(propiosFinal.map((s) => s.garantia.valida)) === JSON.stringify(c.esperado.valida), `garantía válida: ${c.esperado.valida}`);
  revisar(JSON.stringify(propiosFinal.map((s) => s.garantia.pagador)) === JSON.stringify(c.esperado.pagador), `paga: ${c.esperado.pagador}`);
  if (c.esperado.motivo) revisar(propiosFinal.some((s) => c.esperado.motivo.test(s.garantia.respuesta)), `motivo ${c.esperado.motivo}`);

  // 7. Facturación consulta la cotización (mano de obra con precio; repuestos solo con código).
  const cot = await llamar('agente-facturacion', 'consultar_cotizacion', { codigo });
  console.log(gris(`    mano de obra: ${cot.mano_obra.map((l) => `${l.sku} ${pesos(l.precio)} (${l.garantia.pagador})`).join(', ')}`));
  console.log(gris(`    repuestos: ${cot.repuestos.map((r) => `${r.cantidad}× ${r.codigo_repuesto}`).join(', ') || 'ninguno: solo mano de obra'}`));
  console.log(gris(`    Telegram al cliente: «${cot.mensaje_garantia}»`));
  revisar(cot.repuestos.every((r) => !('precio' in r)), 'los repuestos van sin precio (lo pone facturación)');
  if (c.esperado.sinRepuestos) revisar(cot.repuestos.length === 0 && !cot.hay_repuestos, 'solo mano de obra');
  if (c.esperado.skus) revisar(JSON.stringify(cot.mano_obra.map((l) => l.sku)) === JSON.stringify(c.esperado.skus), `cobra ${c.esperado.skus.join(' + ')}`);
  if (c.esperado.mensaje) revisar(c.esperado.mensaje.test(cot.mensaje_garantia), `mensaje ${c.esperado.mensaje}`);

  // 8. Respuesta del cliente por Telegram (facturación arma la orden de compra con las tiendas).
  if (c.rechazar) {
    orden = await llamar('agente-facturacion', 'registrar_respuesta_cliente', { codigo, aceptada: false, motivo: 'El cliente no aceptó el valor', id_mensaje: id() });
    orden = await llamar('agente-concesionario', 'registrar_salida', { codigo, id_mensaje: id() });
    revisar(orden.estado === 'entregada', 'sale sin reparar');
    return codigo;
  }
  const ordenCompra = ordenDeCompra(cot.repuestos);
  orden = await llamar('agente-facturacion', 'registrar_respuesta_cliente', { codigo, aceptada: true, referencia: `FAC-${codigo}`, orden_compra: ordenCompra, id_mensaje: id() });
  revisar(orden.estado === 'aprobada' && orden.acciones_disponibles.includes('tomar_orden'), 'aprobada: sigue un mecánico (tomar_orden)');

  // 9. Reparación.
  let rep = await llamar(mecanico, 'tomar_orden', { codigo, id_mensaje: id() });
  rep = await llamar(mecanico, 'registrar_horas', { codigo, inicio: new Date(Date.now() - 2 * 3600_000).toISOString(), fin: new Date().toISOString(), nota: 'Simulación' });
  for (const s of rep.servicios.filter((x) => !x.fija)) rep = await llamar(mecanico, 'marcar_tarea', { codigo, tarea_id: s.id, completada: true }, { mostrar: false });
  for (const compra of rep.orden_compra) {
    rep = await llamar(mecanico, 'registrar_parte_usada', { codigo, codigo_repuesto: compra.codigo_repuesto, cantidad: compra.cantidad, compra_id: compra.id }, { mostrar: false });
  }
  console.log(gris(`    partes usadas: ${rep.partes_usadas.map((p) => `${p.cantidad}× ${p.codigo_repuesto} (${p.tienda})`).join(', ') || 'ninguna'}`));
  rep = await llamar(mecanico, 'terminar_reparacion', { codigo, id_mensaje: id() });
  revisar(rep.estado_orden === 'pendiente_facturacion', 'pendiente de facturación');

  // 10. Facturación cobra con PSE y confirma; el vehículo sale.
  orden = await llamar('agente-facturacion', 'registrar_pago', { codigo, referencia_pse: `PSE-${Date.now()}`, valor: cot.total_mano_obra_cliente, id_mensaje: id() });
  orden = await llamar('agente-concesionario', 'registrar_salida', { codigo, id_mensaje: id() });
  revisar(orden.estado === 'entregada', 'facturada y entregada');

  // Lo que el taller les envió a los otros agentes por esta orden.
  const bandeja = await llamar('agente-concesionario', 'consultar_bandeja', {}, { mostrar: false });
  const deLaOrden = bandeja.ultimos.filter((e) => e.datos?.codigo === codigo);
  const enviados = [...new Set(deLaOrden.map((e) => `${e.destino}.${e.herramienta}`))];
  revisar(enviados.includes('facturacion.crear_cotizacion') && enviados.includes('facturacion.notificar_reparacion_terminada'), 'a facturación: cotización y reparación terminada', enviados);
  return codigo;
}

// ---------- Comandos ----------
const [comando = 'casos', ...args] = process.argv.slice(2);

try {
  if (comando === 'casos') {
    console.log('Casos disponibles:');
    for (const [n, c] of Object.entries(CASOS)) console.log(`  ${negrita(n.padEnd(24))} ${c.descripcion}`);
    process.exit(0);
  }
  await prepararUsuarios();
  if (comando === 'todos') {
    for (const nombre of Object.keys(CASOS)) await correrCaso(nombre);
  } else if (CASOS[comando]) {
    await correrCaso(comando);
  } else if (comando === 'herramientas') {
    const { tools } = await (await mcp(args[0] === 'mecanico' ? 'mec-centro' : 'agente-concesionario')).listTools();
    for (const t of tools) console.log(`  ${t.name.padEnd(30)} ${gris(t.title ?? '')}`);
    console.log(`${tools.length} herramientas`);
  } else if (comando === 'agendar') {
    const [idRelacion, sede, ...mensajes] = args;
    const textos = mensajes.length ? mensajes : ['Revisión'];
    const destino = sede ?? (await llamar('agente-concesionario', 'prediagnosticar', { id_relacion: idRelacion, mensajes_cliente: textos })).sede_sugerida.codigo;
    const o = await llamar('agente-concesionario', 'agendar_cita', { id_relacion: idRelacion, taller: destino, fecha_hora: await primeraFranja(destino), mensajes_cliente: textos });
    console.log(`${o.codigo} agendada en ${o.sede.nombre}. ${o.siguiente_paso.descripcion}`);
  } else if (comando === 'estado') {
    const o = await llamar('agente-concesionario', 'estado_orden', { codigo: args[0] });
    console.log(JSON.stringify({ estado: o.estado, sede: o.sede.nombre, siguiente_paso: o.siguiente_paso, acciones: o.acciones_disponibles }, null, 2));
  } else if (comando === 'garantia') {
    const d = await llamar('agente-concesionario', 'consultar_diagnostico', { codigo: args[0] }, { mostrar: false });
    const valida = args[1] === 'si';
    await llamar('agente-concesionario', 'registrar_resultado_garantia', {
      codigo: args[0],
      resultados: d.servicios.filter((s) => !s.fija).map((s) => ({ tarea_id: s.id, valida, motivo: valida ? 'Garantía válida' : 'No cubierto por la garantía' })),
    });
  } else if (comando === 'facturacion-aceptar' || comando === 'facturacion-rechazar') {
    const cot = await llamar('agente-facturacion', 'consultar_cotizacion', { codigo: args[0] });
    const aceptada = comando === 'facturacion-aceptar';
    await llamar('agente-facturacion', 'registrar_respuesta_cliente', {
      codigo: args[0],
      aceptada,
      ...(aceptada ? { orden_compra: ordenDeCompra(cot.repuestos) } : { motivo: 'El cliente no aceptó' }),
    });
  } else if (comando === 'pago') {
    await llamar('agente-facturacion', 'registrar_pago', { codigo: args[0], referencia_pse: `PSE-${Date.now()}`, valor: 0 });
  } else if (comando === 'salida') {
    await llamar('agente-concesionario', 'registrar_salida', { codigo: args[0] });
  } else {
    console.error(`Comando desconocido: ${comando}. Use: npm run simular -- casos`);
    process.exit(1);
  }
} catch (error) {
  fallar();
  console.error(rojo(`\n${error.message}`));
} finally {
  await cerrarClientes();
}
if (comando === 'todos' || CASOS[comando]) console.log(fallidas() ? rojo(`\n${fallidas()} verificación(es) fallaron.`) : verde('\nTodos los casos llegaron a su estado esperado.'));
process.exit(fallidas() ? 1 : 0);
