import { z } from 'zod';

const texto = (max: number, campo: string) =>
  z.string().trim().min(1, `${campo} es obligatorio`).max(max, `${campo}: máximo ${max} caracteres`);

export const clave = z
  .string()
  .min(10, 'La clave debe tener al menos 10 caracteres')
  .max(100, 'La clave es demasiado larga');

export const entrarDto = z.object({
  usuario: texto(40, 'El usuario').transform((u) => u.toLowerCase()),
  clave: z.string().min(1, 'La clave es obligatoria').max(100),
});

export const nuevoUsuarioDto = z.object({
  nombre: texto(80, 'El nombre'),
  apellido: texto(80, 'El apellido'),
  documento: z.string().trim().regex(/^[0-9A-Za-z-]{5,20}$/, 'Documento inválido (5 a 20 letras, números o guiones)'),
  telefono: z.string().trim().regex(/^[0-9+ ]{7,20}$/, 'Teléfono inválido'),
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/, 'Usuario: de 3 a 40 letras minúsculas, números, punto, guion o guion bajo'),
  clave,
  rol: texto(40, 'El rol'),
  // Sede del mecánico (obligatoria para el rol mecanico).
  tallerId: z.number().int().positive().nullable().optional(),
});

export const editarUsuarioDto = nuevoUsuarioDto
  .omit({ usuario: true, clave: true })
  .partial()
  .extend({ clave: clave.optional(), activo: z.boolean().optional() });

export const editarRolDto = z.object({ descripcion: z.string().trim().max(200) });

export type NuevoUsuario = z.infer<typeof nuevoUsuarioDto>;
export type EditarUsuario = z.infer<typeof editarUsuarioDto>;
