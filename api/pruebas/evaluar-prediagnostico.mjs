// Evalúa el agente de prediagnóstico con casos de respuesta conocida (casos-prediagnostico.json),
// con el catálogo y las sedes reales de la base. Requiere la base migrada y con semilla.
//
//   npm run evaluar                 con el modelo local (LOCAL_URL); si falla, el agente usa las reglas
//   npm run evaluar -- --reglas     línea base: solo las reglas por palabras clave
//   npm run evaluar -- --sin-tope   el mismo prompt, esperando al modelo hasta 3 minutos: mide
//                                   la calidad del modelo cuando el tope no lo corta
//
// Cada caso se califica por su ruta, que es lo que decide a qué sede va el carro:
//   acierto     la especialidad es la esperada (en los casos vagos, que vaya a revisión general)
//   de más      acertó la especialidad pero con poca confianza: lo revisa mantenimiento (cuesta
//               tiempo, no es peligroso)
//   segura      se equivocó, pero el carro va a revisión general, donde lo revisa una persona
//   PELIGROSA   se equivocó y el carro va directo a una sede especializada equivocada
// Deja el detalle en resultados/evaluacion-prediagnostico-<modo>.csv.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bd } from '../src/base-datos/conexion';
import { prediagnosticar, llamarModeloLocal, tiempoModeloMs } from '../src/prediagnostico/agente';
import { catalogoServicios } from '../src/servicios/servicios.service';
import { Taller } from '../src/talleres/taller.entity';

const soloReglas = process.argv.includes('--reglas');
const sinTope = process.argv.includes('--sin-tope');
const modo = soloReglas ? 'reglas' : sinTope ? 'modelo-sin-tope' : 'modelo';
const { casos } = JSON.parse(readFileSync(join(import.meta.dirname, 'casos-prediagnostico.json'), 'utf8'));

const catalogo = await catalogoServicios();
const sedes = await (await bd()).getRepository(Taller).find();
const sinModelo = async () => {
  throw new Error('Línea base: sin modelo');
};
// La misma petición de llamarModeloLocal, con 3 minutos de espera en lugar del tope del servicio.
const TRES_MINUTOS = 180_000;
const llamarSinTope = async (sistema, usuario) => {
  const respuesta = await fetch(`${process.env.LOCAL_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LOCAL_KEY ?? 'ollama'}` },
    body: JSON.stringify({
      model: process.env.LOCAL_MODELO ?? 'llama3.2',
      temperature: 0,
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(TRES_MINUTOS),
  });
  const contenido = (await respuesta.json()).choices?.[0]?.message?.content ?? '';
  return JSON.parse(String(contenido).replace(/^```(?:json)?|```$/g, '').trim());
};

console.log(soloReglas
  ? 'Línea base: reglas por palabras clave'
  : `Modelo ${process.env.LOCAL_MODELO ?? 'llama3.2'} en ${process.env.LOCAL_URL ?? '(sin LOCAL_URL)'}, ` +
    `tope ${sinTope ? TRES_MINUTOS : tiempoModeloMs()} ms`);

const filas = [];
for (const caso of casos) {
  // Se anota qué devolvió el modelo, para distinguir «no respondió» de «respondió algo inválido».
  let salidaModelo = soloReglas ? '(sin modelo)' : '(no respondió a tiempo)';
  const base = soloReglas ? sinModelo : sinTope ? llamarSinTope : llamarModeloLocal;
  const llamar = async (sistema, usuario) => {
    const salida = await base(sistema, usuario);
    salidaModelo = JSON.stringify(salida);
    return salida;
  };
  const inicio = performance.now();
  const r = await prediagnosticar(caso.mensajes, caso.vehiculo, catalogo, sedes, llamar);
  const ms = Math.round(performance.now() - inicio);
  const vago = caso.especialidad === 'mantenimiento_general';
  const acierto = vago ? r.ruta === 'revision_general' : r.especialidad === caso.especialidad;
  let revision;
  if (acierto) revision = !vago && r.ruta === 'revision_general' ? 'de más' : 'bien';
  else revision = r.ruta === 'revision_general' ? 'segura' : 'PELIGROSA';
  const serviciosOk = caso.servicios.every((s) => r.servicios.includes(s));
  filas.push({ ...caso, r, ms, acierto, revision, serviciosOk, salidaModelo });
  console.log(
    `${caso.id} ${acierto ? 'ACIERTO' : 'ERROR  '} ${revision.padEnd(9)} ${String(ms).padStart(6)} ms  ` +
      `${r.fuente.padEnd(6)} ${r.especialidad.padEnd(21)} ${r.ruta.padEnd(16)} conf ${r.confianza.toFixed(2)}  ` +
      `[${r.servicios.join(', ')}]  esperado ${caso.especialidad} [${caso.servicios.join(', ')}]`,
  );
}

const n = filas.length;
const aciertos = filas.filter((f) => f.acierto).length;
const cuenta = (v) => filas.filter((f) => f.revision === v).length;
const planB = filas.filter((f) => f.r.fuente === 'reglas').length;
const tiempos = filas.map((f) => f.ms).sort((a, b) => a - b);
const p50 = tiempos[Math.floor((n - 1) / 2)];
console.log(
  `\nAcierto: ${Math.round((aciertos / n) * 100)}% (${aciertos} de ${n}) | ` +
    `Revisión: ${cuenta('bien')} bien, ${cuenta('de más')} de más, ${cuenta('segura')} errores seguros, ` +
    `${cuenta('PELIGROSA')} PELIGROSOS | Servicios esperados: ${filas.filter((f) => f.serviciosOk).length} de ${n} | ` +
    `Respondió con reglas: ${planB} de ${n} | Latencia p50 ${p50} ms, máxima ${tiempos[n - 1]} ms`,
);

const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
const carpeta = join(import.meta.dirname, '..', 'resultados');
mkdirSync(carpeta, { recursive: true });
const archivo = join(carpeta, `evaluacion-prediagnostico-${modo}.csv`);
writeFileSync(archivo, [
  'caso;resultado;revision;ms;fuente;especialidad;ruta;confianza;servicios;especialidad_esperada;servicios_esperados;servicios_ok;salida_modelo',
  ...filas.map((f) => [
    f.id, f.acierto ? 'ACIERTO' : 'ERROR', f.revision, f.ms, f.r.fuente, f.r.especialidad, f.r.ruta,
    f.r.confianza, f.r.servicios.join(' '), f.especialidad, f.servicios.join(' '), f.serviciosOk ? 'si' : 'no',
    f.salidaModelo,
  ].map(csv).join(';')),
].join('\n'));
console.log(`Detalle en ${archivo}`);
await (await bd()).destroy();
