import { ruta } from '@/comun/guardia';
import { buscarCodigosRepuesto } from '@/servicios/servicios.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Códigos universales de repuestos: ?buscar=pastillas
export const GET = ruta(TALLER, async ({ url }) => buscarCodigosRepuesto(url.searchParams.get('buscar') ?? undefined));
