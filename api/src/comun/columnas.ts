import type { ValueTransformer } from 'typeorm';

// pg devuelve las columnas numeric como texto. Se convierten a número al leer.
export const numerico: ValueTransformer = {
  to: (valor: number | null | undefined) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

// Redondea a centavos: los montos nunca se guardan con más de dos decimales.
export const pesos = (valor: number) => Math.round(valor * 100) / 100;
