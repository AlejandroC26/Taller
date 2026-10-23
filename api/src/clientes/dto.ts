import { z } from 'zod';

const texto = (max: number, campo: string) =>
  z.string().trim().min(1, `${campo} es obligatorio`).max(max, `${campo}: máximo ${max} caracteres`);

// Placas colombianas y similares: letras y números, sin espacios ni guiones.
export const normalizarPlaca = (placa: string) => placa.toUpperCase().replace(/[\s-]/g, '');
export const placa = z
  .string()
  .transform(normalizarPlaca)
  .pipe(z.string().regex(/^[A-Z0-9]{5,8}$/, 'Placa inválida: de 5 a 8 letras o números'));

export const clienteDto = z.object({
  nombre: texto(80, 'El nombre'),
  apellido: texto(80, 'El apellido'),
  documento: z.string().trim().regex(/^[0-9A-Za-z-]{5,20}$/, 'Documento inválido (5 a 20 letras, números o guiones)'),
  telefono: z.string().trim().regex(/^[0-9+ ]{7,20}$/, 'Teléfono inválido'),
  correo: z.email('Correo inválido').max(150).optional().nullable(),
  direccion: z.string().trim().max(200).optional().nullable(),
});
export const editarClienteDto = clienteDto.partial();

const anioMaximo = new Date().getFullYear() + 1;
// Campos sin valores por defecto: al editar, lo que no se envía no cambia.
const camposVehiculo = {
  marca: texto(40, 'La marca'),
  modelo: texto(60, 'El modelo'),
  anio: z.number().int().min(1950, 'Año inválido').max(anioMaximo, 'Año inválido'),
  color: z.string().trim().max(30),
  kilometraje: z.number().int().min(0, 'El kilometraje no puede ser negativo'),
};
export const vehiculoDto = z.object({
  ...camposVehiculo,
  placa,
  color: camposVehiculo.color.default(''),
  kilometraje: camposVehiculo.kilometraje.default(0),
});
export const editarVehiculoDto = z.object(camposVehiculo).partial();

export type DatosCliente = z.infer<typeof clienteDto>;
export type DatosVehiculo = z.infer<typeof vehiculoDto>;
