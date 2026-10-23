import { ruta } from '@/comun/guardia';
import { SOLO_ADMIN } from '@/usuarios/rol.entity';
import { listarRoles } from '@/usuarios/usuarios.service';

export const runtime = 'nodejs';

// Los roles son fijos: no se crean ni se borran (ver editarRol).
export const GET = ruta(SOLO_ADMIN, async () => listarRoles());
