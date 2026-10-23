// Prueba de punta a punta contra la API en marcha y la base real: recorre el flujo
// completo de una orden con cada rol y verifica cada respuesta.
//   node pruebas/flujo.mjs
// Crea usuarios de prueba (recepción, dos mecánicos y el concesionario) y guarda sus
// claves en pruebas/.usuarios-prueba.json (en .gitignore).
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, CARPETA, pedir } from './comun.mjs';

let fallas = 0;
function revisar(condicion, descripcion, detalle) {
  if (condicion) console.log(`  ✓ ${descripcion}`);
  else {
    fallas++;
    console.log(`  ✗ ${descripcion}${detalle ? `\n      ${typeof detalle === 'string' ? detalle : JSON.stringify(detalle)}` : ''}`);
  }
}
const paso = (titulo) => console.log(`\n${titulo}`);
const azar = (n = 6) => randomBytes(8).toString('hex').replace(/[a-f]/g, '').padEnd(n, '7').slice(0, n);

// ---------- Sesiones ----------
paso('1. Administrador y usuarios de prueba');
const admin = await pedir('/api/auth/entrar', {
  metodo: 'POST',
  cuerpo: { usuario: process.env.TALLER_ADMIN_USUARIO, clave: process.env.TALLER_ADMIN_CLAVE },
});
revisar(admin.estado === 200, 'el administrador inicia sesión', admin.json);
if (admin.estado !== 200) process.exit(1);
const tAdmin = admin.json.token;

const archivo = join(CARPETA, '.usuarios-prueba.json');
const usuarios = existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : {};
for (const [clave, rol, nombre] of [
  ['recepcion', 'recepcionista', 'Rosa'],
  ['mecanico1', 'mecanico', 'Mario'],
  ['mecanico2', 'mecanico', 'Nora'],
  ['concesionario', 'concesionario', 'Concesionario'],
]) {
  if (usuarios[clave]) continue;
  const datos = {
    nombre,
    apellido: 'Prueba',
    documento: `9${azar(9)}`,
    telefono: '3000000000',
    usuario: `${clave}.${azar(4)}`,
    clave: `Prueba-${randomBytes(9).toString('base64url')}`,
    rol,
  };
  const r = await pedir('/api/usuarios', { metodo: 'POST', cuerpo: datos, token: tAdmin });
  revisar(r.estado === 201, `crea el usuario ${rol} ${datos.usuario}`, r.json);
  usuarios[clave] = { usuario: datos.usuario, clave: datos.clave, id: r.json?.id };
}
writeFileSync(archivo, JSON.stringify(usuarios, null, 2));

const tokens = {};
for (const [clave, u] of Object.entries(usuarios)) {
  const r = await pedir('/api/auth/entrar', { metodo: 'POST', cuerpo: { usuario: u.usuario, clave: u.clave } });
  revisar(r.estado === 200, `${clave} inicia sesión`);
  tokens[clave] = r.json?.token;
}
const { recepcion: tRec, mecanico1: tM1, mecanico2: tM2, concesionario: tCon } = tokens;
const mal = await pedir('/api/auth/entrar', { metodo: 'POST', cuerpo: { usuario: usuarios.recepcion.usuario, clave: 'clave-errada-123' } });
revisar(mal.estado === 401 && mal.json.message === 'Usuario o clave incorrectos', 'una clave errada responde 401 sin pistas');
revisar((await pedir('/api/usuarios', { token: tRec })).estado === 403, 'la recepcionista no administra usuarios (403)');

// ---------- Recepción ----------
paso('2. Recepción: cliente, vehículo y orden');
const cliente = await pedir('/api/clientes', {
  metodo: 'POST',
  token: tRec,
  cuerpo: { nombre: 'Carlos', apellido: 'Rojas', documento: `1${azar(9)}`, telefono: '3104445566', correo: 'carlos@ejemplo.test' },
});
revisar(cliente.estado === 201, 'registra el cliente', cliente.json);
const placa = `TL${azar(4)}`;
const vehiculo = await pedir(`/api/clientes/${cliente.json.id}/vehiculos`, {
  metodo: 'POST',
  token: tRec,
  cuerpo: { placa: placa.toLowerCase(), marca: 'Mazda', modelo: '3 Touring', anio: 2021, color: 'Gris', kilometraje: 45000 },
});
revisar(vehiculo.estado === 201 && vehiculo.json.placa === placa, `registra el vehículo ${placa} (placa normalizada)`, vehiculo.json);
const repetido = await pedir(`/api/clientes/${cliente.json.id}/vehiculos`, {
  metodo: 'POST',
  token: tRec,
  cuerpo: { placa, marca: 'Mazda', modelo: '3', anio: 2021 },
});
revisar(repetido.estado === 409, 'una placa repetida responde 409');

const orden = await pedir('/api/ordenes', {
  metodo: 'POST',
  token: tRec,
  cuerpo: { placa, motivo: 'Cambio de aceite y ruido al frenar', kilometraje: 45200 },
});
revisar(orden.estado === 201 && orden.json.estado === 'recibido', 'abre la orden en estado recibido', orden.json);
const cod = orden.json.codigo;
const otra = await pedir('/api/ordenes', { metodo: 'POST', token: tRec, cuerpo: { placa, motivo: 'Otra cosa' } });
revisar(otra.estado === 409, 'no permite dos órdenes abiertas para el mismo vehículo');

// ---------- Asignación ----------
paso(`3. Asignación del diagnóstico (${cod})`);
const disp = await pedir('/api/mecanicos/disponibilidad', { token: tRec });
revisar(disp.estado === 200 && disp.json.some((m) => m.id === usuarios.mecanico1.id), 'la disponibilidad lista a los mecánicos', disp.json);
const asig = await pedir(`/api/ordenes/${cod}/asignaciones`, {
  metodo: 'POST',
  token: tRec,
  cuerpo: { mecanicoId: usuarios.mecanico1.id, etapa: 'diagnostico' },
});
revisar(asig.estado === 201 && asig.json.estado === 'en_diagnostico', 'asignar diagnóstico pasa la orden a en_diagnostico', asig.json);
const repar = await pedir(`/api/ordenes/${cod}/asignaciones`, {
  metodo: 'POST',
  token: tRec,
  cuerpo: { mecanicoId: usuarios.mecanico2.id, etapa: 'reparacion' },
});
revisar(repar.estado === 400, 'no se asigna reparación sin diagnóstico aprobado (400)');
revisar((await pedir(`/api/ordenes/${cod}`, { token: tM2 })).estado === 404, 'otro mecánico no ve la orden (404)');
revisar((await pedir(`/api/ordenes/${cod}`, { token: tM1 })).estado === 200, 'el mecánico asignado sí la ve');
const lista = await pedir('/api/ordenes', { token: tM2 });
revisar(lista.estado === 200 && !lista.json.some((o) => o.codigo === cod), 'la lista del otro mecánico no la incluye');

// ---------- Diagnóstico ----------
paso('4. Diagnóstico del mecánico');
const inventario = await pedir('/api/inventario', { token: tM1 });
revisar(inventario.estado === 200, 'el mecánico consulta el inventario');
const filtro = inventario.json.find((i) => i.codigo === 'FIL-ACE-01');
const aceite = inventario.json.find((i) => i.codigo === 'ACE-5W30');
revisar((await pedir('/api/inventario', { metodo: 'POST', token: tM1, cuerpo: { codigo: 'X1', nombre: 'X', precio: 1, categoriaId: 1 } })).estado === 403, 'el mecánico no crea ítems (403)');
const cuerpoDiag = {
  observaciones: 'Aceite degradado. Pastillas delanteras al 10 %. Sensor de oxígeno con lectura errática.',
  tareas: [
    {
      descripcion: 'Drenar aceite, cambiar filtro y llenar con 4 cuartos de 5W-30',
      horasEstimadas: 1,
      valorServicio: 30000,
      repuestos: [{ itemId: filtro.id, cantidad: 1 }, { itemId: aceite.id, cantidad: 4 }],
    },
    {
      descripcion: 'Reemplazar sensor de oxígeno',
      horasEstimadas: 0.5,
      valorServicio: 0,
      repuestos: [{ descripcion: 'Sensor de oxígeno Mazda 3 2021', cantidad: 1, precioUnitario: 180000 }],
    },
  ],
};
revisar((await pedir(`/api/ordenes/${cod}/diagnostico`, { metodo: 'PUT', token: tRec, cuerpo: cuerpoDiag })).estado === 403, 'la recepcionista no registra diagnósticos (403)');
revisar((await pedir(`/api/ordenes/${cod}/diagnostico`, { metodo: 'PUT', token: tM2, cuerpo: cuerpoDiag })).estado === 404, 'un mecánico no asignado no puede (404)');
const diag = await pedir(`/api/ordenes/${cod}/diagnostico`, { metodo: 'PUT', token: tM1, cuerpo: cuerpoDiag });
const tarifa = diag.json?.tarifaHora;
const esperado = 1.5 * tarifa + 30000 + filtro.precio + 4 * aceite.precio + 180000;
revisar(diag.estado === 200 && diag.json.tareas.length === 2, 'guarda el paso a paso', diag.json);
revisar(diag.json?.costo.total === esperado, `el costo estimado es ${esperado}`, diag.json?.costo);
revisar(diag.json?.tareas[1].repuestos[0].disponible === false, 'la pieza fuera de inventario queda como no disponible');
const tarifaMec = await pedir(`/api/ordenes/${cod}/diagnostico`, { metodo: 'PUT', token: tM1, cuerpo: { ...cuerpoDiag, tarifaHora: 1 } });
revisar(tarifaMec.estado === 403, 'el mecánico no cambia la tarifa por hora (403)');
const fin = await pedir(`/api/ordenes/${cod}/diagnostico/finalizar`, { metodo: 'POST', token: tM1 });
revisar(fin.estado === 200 && fin.json.estadoOrden === 'diagnosticado', 'finalizar deja la orden por aprobar', fin.json);
revisar((await pedir(`/api/ordenes/${cod}/diagnostico`, { metodo: 'PUT', token: tM1, cuerpo: cuerpoDiag })).estado === 400, 'un diagnóstico finalizado ya no se edita');

// ---------- Aprobación y reparación ----------
paso('5. Aprobación y reparación');
revisar((await pedir(`/api/ordenes/${cod}/estado`, { metodo: 'POST', token: tM1, cuerpo: { estado: 'aprobado' } })).estado === 403, 'el mecánico no aprueba (403)');
const aprob = await pedir(`/api/ordenes/${cod}/estado`, { metodo: 'POST', token: tRec, cuerpo: { estado: 'aprobado', nota: 'Cliente aceptó por teléfono' } });
revisar(aprob.estado === 200 && aprob.json.estado === 'aprobado', 'la recepcionista aprueba', aprob.json);
const asigR = await pedir(`/api/ordenes/${cod}/asignaciones`, { metodo: 'POST', token: tRec, cuerpo: { mecanicoId: usuarios.mecanico1.id, etapa: 'reparacion' } });
revisar(asigR.estado === 201 && asigR.json.estado === 'en_reparacion', 'asignar reparación pasa a en_reparacion', asigR.json);

const antes = (await pedir(`/api/inventario/${filtro.id}`, { token: tRec })).json.cantidad;
const ahora = new Date();
const horas = await pedir(`/api/ordenes/${cod}/reparacion/horas`, {
  metodo: 'POST',
  token: tM1,
  cuerpo: { inicio: new Date(ahora - 2 * 3600_000).toISOString(), fin: ahora.toISOString(), nota: 'Cambio de aceite y sensor' },
});
revisar(horas.estado === 201 && horas.json.real.horas === 2, 'registra 2 horas', horas.json?.real);
const malas = await pedir(`/api/ordenes/${cod}/reparacion/horas`, {
  metodo: 'POST',
  token: tM1,
  cuerpo: { inicio: ahora.toISOString(), fin: new Date(ahora - 3600_000).toISOString() },
});
revisar(malas.estado === 400, 'horas con fin antes del inicio responden 400');
const p1 = await pedir(`/api/ordenes/${cod}/reparacion/partes`, { metodo: 'POST', token: tM1, cuerpo: { itemId: filtro.id, cantidad: 1 } });
const p2 = await pedir(`/api/ordenes/${cod}/reparacion/partes`, { metodo: 'POST', token: tM1, cuerpo: { itemId: aceite.id, cantidad: 4 } });
revisar(p1.estado === 201 && p2.estado === 201, 'registra las partes usadas');
const despues = (await pedir(`/api/inventario/${filtro.id}`, { token: tRec })).json.cantidad;
revisar(despues === antes - 1, `el inventario del filtro baja de ${antes} a ${despues}`);
const demasiado = await pedir(`/api/ordenes/${cod}/reparacion/partes`, { metodo: 'POST', token: tM1, cuerpo: { itemId: filtro.id, cantidad: 9999 } });
revisar(demasiado.estado === 409, 'sin existencias suficientes responde 409', demasiado.json);
const t1 = p2.json.tareas[0].id;
const marcar = await pedir(`/api/ordenes/${cod}/reparacion/tareas/${t1}`, { metodo: 'PATCH', token: tM1, cuerpo: { completada: true } });
revisar(marcar.estado === 200 && marcar.json.tareas[0].completada, 'marca el primer paso como hecho');
const term = await pedir(`/api/ordenes/${cod}/reparacion/terminar`, { metodo: 'POST', token: tM1 });
const totalReal = 30000 + 2 * tarifa + filtro.precio + 4 * aceite.precio;
revisar(term.estado === 200 && term.json.estadoOrden === 'terminado', 'termina la reparación', term.json);
revisar(term.json?.real.total === totalReal, `la liquidación cobra servicios + horas + partes = ${totalReal}`, term.json?.real);
const movs = await pedir(`/api/inventario/${filtro.id}/movimientos`, { token: tRec });
revisar(movs.json.some((m) => m.tipo === 'salida' && m.nota.includes(cod)), 'queda el movimiento de salida con la orden');
const ent = await pedir(`/api/ordenes/${cod}/estado`, { metodo: 'POST', token: tRec, cuerpo: { estado: 'entregado' } });
revisar(ent.estado === 200 && ent.json.estado === 'entregado', 'entrega el carro');
revisar(ent.json.historial.map((h) => h.estado).join('>') === 'recibido>en_diagnostico>diagnosticado>aprobado>en_reparacion>terminado>entregado', 'la línea de tiempo tiene todo el recorrido');
revisar((await pedir(`/api/ordenes/${cod}/cancelar`, { metodo: 'POST', token: tRec, cuerpo: { motivo: 'Ya no se puede' } })).estado === 400, 'una orden entregada no se cancela');

// ---------- Cancelación ----------
paso('6. Cancelación durante el diagnóstico');
const placa2 = `TC${azar(4)}`;
await pedir(`/api/clientes/${cliente.json.id}/vehiculos`, { metodo: 'POST', token: tRec, cuerpo: { placa: placa2, marca: 'Kia', modelo: 'Picanto', anio: 2018 } });
const o2 = (await pedir('/api/ordenes', { metodo: 'POST', token: tRec, cuerpo: { placa: placa2, motivo: 'Revisión general' } })).json.codigo;
await pedir(`/api/ordenes/${o2}/asignaciones`, { metodo: 'POST', token: tRec, cuerpo: { mecanicoId: usuarios.mecanico2.id, etapa: 'diagnostico' } });
revisar((await pedir(`/api/ordenes/${o2}/cancelar`, { metodo: 'POST', token: tRec, cuerpo: {} })).estado === 400, 'cancelar sin motivo responde 400');
const canc = await pedir(`/api/ordenes/${o2}/cancelar`, { metodo: 'POST', token: tRec, cuerpo: { motivo: 'El cliente retiró el vehículo' } });
revisar(canc.estado === 200 && canc.json.estado === 'cancelado' && canc.json.diagnostico.estado === 'cancelado', 'cancela la orden y su diagnóstico', canc.json);

// ---------- Inventario ----------
paso('7. Inventario y alertas');
const item = await pedir('/api/inventario', {
  metodo: 'POST',
  token: tRec,
  cuerpo: { codigo: `PRB-${azar(4)}`, nombre: 'Ítem de prueba', precio: 1000, cantidad: 3, nivelAlerta: 2, categoriaId: inventario.json[0].categoriaId },
});
revisar(item.estado === 201 && item.json.enAlerta === false, 'crea un ítem con 3 unidades y alerta en 2');
const salida = await pedir(`/api/inventario/${item.json.id}/movimientos`, { metodo: 'POST', token: tRec, cuerpo: { tipo: 'salida', cantidad: 1 } });
revisar(salida.estado === 201 && salida.json.enAlerta === true, 'al bajar a 2 entra en alerta');
const alertas = await pedir('/api/inventario/alertas', { token: tM1 });
revisar(alertas.json.some((i) => i.id === item.json.id), 'aparece en /api/inventario/alertas');
const ajuste = await pedir(`/api/inventario/${item.json.id}/movimientos`, { metodo: 'POST', token: tRec, cuerpo: { tipo: 'ajuste', cantidad: 10, nota: 'Conteo físico' } });
revisar(ajuste.json.cantidad === 10 && !ajuste.json.enAlerta, 'un ajuste fija el conteo y sale de alerta');
const editar = await pedir(`/api/inventario/${item.json.id}`, { metodo: 'PATCH', token: tRec, cuerpo: { precio: 1500 } });
revisar(editar.json.precio === 1500 && editar.json.nivelAlerta === 2 && editar.json.cantidad === 10, 'editar el precio no toca el nivel de alerta ni las existencias');

// ---------- Concesionario ----------
paso('8. Concesionario (preparado para su MCP)');
const ref = `CON-${azar(6)}`;
const ingreso = await pedir('/api/integraciones/concesionario/ingresos', {
  metodo: 'POST',
  token: tCon,
  cuerpo: {
    referencia_externa: ref,
    cliente: { nombre: 'Laura', apellido: 'Mejía', documento: `3${azar(9)}`, telefono: '3015556677' },
    vehiculo: { placa: `CN${azar(4)}`, marca: 'Renault', modelo: 'Duster', anio: 2026 },
    motivo: 'Alistamiento antes de la entrega',
  },
});
revisar(ingreso.estado === 201 && ingreso.json.origen === 'concesionario', 'el concesionario envía un carro y se abre la orden', ingreso.json);
const estadoV = await pedir(`/api/integraciones/concesionario/vehiculos/${ref}`, { token: tCon });
revisar(estadoV.estado === 200 && estadoV.json.ordenes[0].estado === 'recibido', 'consulta el estado de su carro');
revisar((await pedir(`/api/ordenes/${cod}`, { token: tCon })).estado === 404, 'no ve órdenes de carros que no envió (404)');
await new Promise((r) => setTimeout(r, 1500));
const integ = await pedir('/api/integraciones', { token: tAdmin });
const destinos = Object.fromEntries(integ.json.destinos.map((d) => [d.destino, d]));
revisar(integ.estado === 200, 'el administrador ve el estado de las integraciones');
revisar((destinos.facturacion.eventos.desactivado ?? 0) + (destinos.facturacion.eventos.enviado ?? 0) > 0, 'la factura quedó en la bandeja de salida', destinos.facturacion.eventos);
revisar((destinos.partes.eventos.desactivado ?? 0) + (destinos.partes.eventos.enviado ?? 0) > 0, 'el pedido del sensor quedó para el proyecto de partes', destinos.partes.eventos);
revisar((destinos.concesionario.eventos.desactivado ?? 0) + (destinos.concesionario.eventos.enviado ?? 0) > 0, 'el aviso al concesionario quedó en la bandeja', destinos.concesionario.eventos);

// ---------- Panel ----------
paso('9. Panel');
const panel = await pedir('/api/panel', { token: tRec });
revisar(panel.estado === 200 && panel.json.facturadoMes >= totalReal, `el panel suma lo facturado del mes (${panel.json?.facturadoMes})`);
revisar((await pedir('/api/panel', { token: tM1 })).estado === 403, 'el mecánico no ve el panel (403)');

// ---------- MCP ----------
paso('10. Servidor MCP');
async function mcp(token) {
  const t = (await pedir('/api/auth/token-mcp', { metodo: 'POST', token })).json.token;
  const cliente = new Client({ name: 'flujo', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  await cliente.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${t}` } } }));
  return cliente;
}
const cm = await mcp(tM1);
const herramientasMec = (await cm.listTools()).tools.map((t) => t.name);
revisar(herramientasMec.includes('registrar_horas') && !herramientasMec.includes('cancelar_orden'), `el mecánico ve ${herramientasMec.length} herramientas, sin cancelar_orden`);
const r1 = await cm.callTool({ name: 'consultar_ordenes', arguments: { codigo: cod } });
revisar(!r1.isError && r1.content[0].text.includes(cod), 'consultar_ordenes devuelve su orden');
await cm.close();
const cc = await mcp(tCon);
revisar((await cc.listTools()).tools.length === 2, 'el concesionario ve solo sus 2 herramientas');
await cc.close();
const sinToken = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${tRec}` } });
revisar(sinToken.status === 401, 'el token web no abre el MCP (401)');

console.log(fallas ? `\n${fallas} verificación(es) fallaron.` : '\nTodo el flujo funciona.');
process.exit(fallas ? 1 : 0);
