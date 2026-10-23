import { ruta } from '@/comun/guardia';
import { disponibilidad } from '@/ordenes/ordenes.service';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const GET = ruta(PERSONAL, async () => disponibilidad());
