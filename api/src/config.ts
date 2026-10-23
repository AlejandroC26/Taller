import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Carpeta de la API (taller/api). Los comandos npm siempre se ejecutan desde aquí.
export const RAIZ = process.cwd();

// Las variables están en SENA-IA/.env, el mismo archivo de los otros proyectos.
const archivo = join(RAIZ, '..', '..', '.env');
if (existsSync(archivo)) process.loadEnvFile(archivo);

// Una variable obligatoria que falta detiene el programa con un mensaje claro.
export function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor)
    throw new Error(`Falta la variable ${nombre} en el archivo SENA-IA/.env`);
  return valor;
}

// Valor por defecto de la mano de obra, en pesos por hora.
export const TARIFA_HORA = Number(process.env.TALLER_TARIFA_HORA ?? 60000);
