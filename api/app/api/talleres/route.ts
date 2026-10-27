import { ruta } from '@/comun/guardia';
import { listarTalleres } from '@/talleres/talleres.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Las sedes de la S.A.S. (para remitir y para asignar la sede de un mecánico).
export const GET = ruta(TALLER, async () => listarTalleres());
