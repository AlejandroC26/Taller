import { ruta } from '@/comun/guardia';
import { reintentar } from '@/integraciones/despachador';
import { SOLO_ADMIN } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const POST = ruta(SOLO_ADMIN, async () => reintentar());
