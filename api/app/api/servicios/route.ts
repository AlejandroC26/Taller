import { ruta } from '@/comun/guardia';
import { listarServicios } from '@/servicios/servicios.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Catálogo de servicios (SKU con su precio de mano de obra).
export const GET = ruta(TALLER, async () => listarServicios());
