import { ruta } from '@/comun/guardia';
import { panel } from '@/ordenes/ordenes.service';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const GET = ruta(PERSONAL, async () => panel());
