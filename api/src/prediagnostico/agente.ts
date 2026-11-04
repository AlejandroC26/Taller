import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NOMBRE_TALLER, RAIZ } from '../config';
import { ESPECIALIDADES } from '../talleres/reglas';
import {
  decidirRuta,
  elegirSede,
  porPalabrasClave,
  resumenPorReglas,
  UMBRAL_ESPECIALIZADA,
  validarSalidaModelo,
} from './reglas';
import type { Prediagnostico, SedeCatalogo, ServicioCatalogo } from './reglas';

// El agente de prediagnóstico: le pregunta al modelo de lenguaje configurado en
// SENA-IA/.env (LOCAL_URL, Ollama u otro compatible con OpenAI) y, si el modelo no está
// o duda, usa las reglas por palabras clave. En la duda, la ruta es revisión general.

export type LlamarModelo = (sistema: string, usuario: string) => Promise<unknown>;

const ESQUEMA = {
  type: 'object',
  properties: {
    especialidad: { type: 'string', enum: [...ESPECIALIDADES] },
    servicios: { type: 'array', items: { type: 'string' } },
    confianza: { type: 'number' },
    resumen: { type: 'string' },
  },
  required: ['especialidad', 'servicios', 'confianza', 'resumen'],
};

// Cuánto se espera al modelo antes de usar las reglas. Corto a propósito: el concesionario
// llama prediagnosticar mientras el cliente espera en el chat y pidió respuesta en menos de
// 30 s, y un modelo local en CPU puede tardar más de 20 s. LOCAL_TIEMPO_MS lo cambia
// (entre 1 y 22 s, para que siempre quede tiempo de responder con las reglas).
export const TOPE_MODELO_MS = 22_000;
export const tiempoModeloMs = (entorno: Record<string, string | undefined> = process.env) => {
  const ms = Number(entorno.LOCAL_TIEMPO_MS);
  return Number.isFinite(ms) && ms > 0 ? Math.min(Math.max(ms, 1_000), TOPE_MODELO_MS) : 8_000;
};

// Llamada sin streaming a /chat/completions, con salida JSON. Si no hay LOCAL_URL no se
// intenta nada.
export const llamarModeloLocal: LlamarModelo = async (sistema, usuario) => {
  const url = process.env.LOCAL_URL;
  if (!url) throw new Error('Sin modelo configurado (LOCAL_URL)');
  const formato = process.env.LOCAL_FORMATO ?? 'json_schema';
  const respuesta = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LOCAL_KEY ?? 'ollama'}` },
    body: JSON.stringify({
      model: process.env.LOCAL_MODELO ?? 'llama3.2',
      temperature: 0,
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
      ...(formato === 'json_schema'
        ? { response_format: { type: 'json_schema', json_schema: { name: 'prediagnostico', schema: ESQUEMA } } }
        : formato === 'json_object'
          ? { response_format: { type: 'json_object' } }
          : {}),
    }),
    signal: AbortSignal.timeout(tiempoModeloMs()),
  });
  if (!respuesta.ok) throw new Error(`El modelo respondió HTTP ${respuesta.status}`);
  const contenido = (await respuesta.json()).choices?.[0]?.message?.content ?? '';
  return JSON.parse(String(contenido).replace(/^```(?:json)?|```$/g, '').trim());
};

function plantilla(): string {
  const archivo = join(RAIZ, 'prompts', 'prediagnostico.txt');
  return existsSync(archivo) ? readFileSync(archivo, 'utf8') : '{{servicios}}';
}

export async function prediagnosticar(
  mensajes: string[],
  vehiculo: string,
  catalogo: ServicioCatalogo[],
  sedes: SedeCatalogo[],
  llamarModelo: LlamarModelo = llamarModeloLocal,
): Promise<Prediagnostico> {
  const texto = mensajes.join(' \n').trim();
  let base: Omit<Prediagnostico, 'ruta' | 'taller'> | null = null;

  if (texto) {
    try {
      const sistema = plantilla()
        .replace('{{taller}}', NOMBRE_TALLER)
        .replace('{{vehiculo}}', vehiculo)
        .replace('{{especialidades}}', ESPECIALIDADES.join(', '))
        .replace('{{servicios}}', catalogo.map((s) => `${s.sku}: ${s.nombre} — ${s.especialidad}`).join('\n'));
      const salida = validarSalidaModelo(await llamarModelo(sistema, texto), catalogo);
      if (salida) base = { ...salida, fuente: 'modelo' };
    } catch {
      // Sin modelo o con respuesta inválida: siguen las reglas.
    }
  }

  // Si el modelo no respondió o duda, se comparan con las reglas y gana la más segura.
  const reglas = porPalabrasClave(texto, catalogo);
  if (!base || (base.confianza < UMBRAL_ESPECIALIZADA && reglas.confianza > base.confianza)) {
    base = { ...reglas, resumen: resumenPorReglas(texto, reglas.especialidad, reglas.confianza), fuente: 'reglas' };
  }

  const ruta = decidirRuta(base.especialidad, base.confianza, sedes);
  const sede = elegirSede(ruta, base.especialidad, sedes);
  return {
    ...base,
    ruta,
    ...(sede ? { taller: { id: sede.id, codigo: sede.codigo, nombre: sede.nombre } } : {}),
  };
}
