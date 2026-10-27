import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Carpeta de la API (taller/api). Los comandos npm siempre se ejecutan desde aquí.
export const RAIZ = process.cwd();

// Las variables están en SENA-IA/.env, el mismo archivo de los otros proyectos. Los
// valores de desarrollo de api/.env.local (fuera del repositorio) se cargan primero y
// tienen prioridad, igual que en Next.
for (const archivo of [join(RAIZ, '.env.local'), join(RAIZ, '..', '..', '.env')]) {
  if (existsSync(archivo)) process.loadEnvFile(archivo);
}

// Una variable obligatoria que falta detiene el programa con un mensaje claro.
export function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor)
    throw new Error(`Falta la variable ${nombre} en el archivo SENA-IA/.env`);
  return valor;
}

// Valor por defecto de la mano de obra, en pesos por hora.
export const TARIFA_HORA = Number(process.env.TALLER_TARIFA_HORA ?? 60000);

// Nombre con el que el taller se presenta ante los asistentes y los otros proyectos.
export const NOMBRE_TALLER = process.env.TALLER_NOMBRE ?? 'Taller Pulgas Locas';
