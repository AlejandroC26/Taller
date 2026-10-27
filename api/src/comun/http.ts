import type { ZodType } from 'zod';
import { ErrorHttp, invalido } from './errores';

// Valida con zod y junta todos los problemas en un solo mensaje en español.
export function validar<T>(esquema: ZodType<T>, datos: unknown): T {
  const r = esquema.safeParse(datos);
  if (!r.success) {
    throw invalido(
      r.error.issues
        .map((i) => (i.path.length ? `${i.path.join('.')}: ` : '') + i.message)
        .join('; '),
    );
  }
  return r.data;
}

export async function leerCuerpo<T>(req: Request, esquema: ZodType<T>): Promise<T> {
  let datos: unknown;
  try {
    datos = await req.json();
  } catch {
    throw invalido('El cuerpo de la petición debe ser JSON válido');
  }
  return validar(esquema, datos);
}

// Para acciones cuyo cuerpo es opcional (por ejemplo, tomar una orden): sin cuerpo se
// valida un objeto vacío.
export async function leerCuerpoOpcional<T>(req: Request, esquema: ZodType<T>): Promise<T> {
  const texto = await req.text();
  if (!texto.trim()) return validar(esquema, {});
  try {
    return validar(esquema, JSON.parse(texto));
  } catch (error) {
    if (error instanceof SyntaxError) throw invalido('El cuerpo de la petición debe ser JSON válido');
    throw error;
  }
}

// Un id de la ruta (/api/clientes/7) como entero positivo.
export function entero(valor: string | null | undefined, campo = 'El id'): number {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) throw invalido(`${campo} no es válido`);
  return numero;
}

// Los errores de negocio salen con su código; los demás se registran y salen como 500
// sin detalles internos.
export function respuestaError(error: unknown): Response {
  if (error instanceof ErrorHttp) {
    return Response.json({ message: error.message }, { status: error.estado });
  }
  console.error(error);
  return Response.json({ message: 'Error interno del servidor' }, { status: 500 });
}
