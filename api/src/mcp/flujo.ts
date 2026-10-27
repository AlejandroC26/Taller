import { NOMBRE_TALLER } from '../config';
import { CAUSAS, NOMBRE_CAUSA, dictamenSugerido, pagadorPorCausa } from '../garantias/reglas';
import { CONTRATO } from '../integraciones/contrato';
import { ESTADOS, PASOS, SIGUIENTE } from '../ordenes/reglas';

// La descripción del flujo sale del código (estados, transiciones, pasos y contrato), así
// nunca se desactualiza frente a lo que el taller hace de verdad.

// Herramientas del taller que llama cada agente externo.
export const ENTRANTES = {
  concesionario: [
    'listar_talleres',
    'prediagnosticar',
    'consultar_disponibilidad',
    'agendar_cita',
    'cancelar_cita',
    'estado_orden',
    'listar_ordenes',
    'consultar_diagnostico',
    'consultar_evidencias',
    'registrar_resultado_garantia',
  ],
  facturacion: ['consultar_cotizacion', 'registrar_respuesta_cliente', 'registrar_pago', 'estado_orden'],
};

export function describirFlujo() {
  return {
    taller: NOMBRE_TALLER,
    estados: ESTADOS.map((estado) => ({
      estado,
      puede_pasar_a: SIGUIENTE[estado],
      responsable: PASOS[estado].responsable,
      descripcion: PASOS[estado].descripcion,
      acciones: PASOS[estado].acciones,
    })),
    garantia: CAUSAS.map((causa) => ({
      causa,
      nombre: NOMBRE_CAUSA[causa],
      dictamen_sugerido: dictamenSugerido(causa) ? 'aplica' : 'no aplica',
      pagador_si_es_valida: pagadorPorCausa(causa),
    })),
    herramientas_del_taller_por_agente: ENTRANTES,
    lo_que_el_taller_envia: CONTRATO,
  };
}

export function flujoMarkdown(): string {
  const f = describirFlujo();
  return [
    `# Flujo de una orden en ${NOMBRE_TALLER}`,
    '',
    'El concesionario agenda (con los mensajes del cliente y el id_relacion); un mecánico diagnostica, dictamina la garantía y puede remitir a una sede especializada; ',
    'el concesionario valida la garantía; facturación cotiza con las tiendas, le escribe al cliente por Telegram y cobra con PSE.',
    '',
    '| Estado | Responsable | Qué pasa | Herramientas | Puede pasar a |',
    '|---|---|---|---|---|',
    ...f.estados.map((e) => `| ${e.estado} | ${e.responsable} | ${e.descripcion} | ${e.acciones.join(', ') || '—'} | ${e.puede_pasar_a.join(', ') || '—'} |`),
    '',
    '## Garantía',
    'El mecánico registra la causa y su dictamen (aplica o no, con motivo y evidencias); el concesionario la valida. La garantía válida la paga la dispersión del responsable, no el cliente.',
    '',
    '| Causa | Dictamen sugerido | Paga si es válida |',
    '|---|---|---|',
    ...f.garantia.map((g) => `| ${g.nombre} (${g.causa}) | ${g.dictamen_sugerido} | ${g.pagador_si_es_valida} |`),
    '',
    'Cada respuesta sobre una orden trae `siguiente_paso` y `acciones_disponibles`. Envíe `id_mensaje` en las llamadas que cambian algo.',
  ].join('\n');
}

export function contratoMarkdown(): string {
  return [
    `# Contrato entre ${NOMBRE_TALLER} y los otros agentes`,
    '',
    '## Herramientas del taller que llama cada agente',
    ...Object.entries(ENTRANTES).map(([agente, herramientas]) => `- **${agente}**: ${herramientas.join(', ')}`),
    '',
    '## Lo que el taller llama en el MCP de cada agente',
    ...Object.entries(CONTRATO).flatMap(([destino, c]) => [
      '',
      `### ${destino}`,
      c.descripcion,
      ...Object.entries(c.herramientas).map(([h, d]) => `- \`${h}\` ${d}`),
    ]),
    '',
    'Se configuran con MCP_<DESTINO>_URL y MCP_<DESTINO>_TOKEN. Sin URL, el concesionario es el simulado y los mensajes a facturación quedan en la bandeja (consultar_bandeja).',
  ].join('\n');
}
