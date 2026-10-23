import { ruta } from '@/comun/guardia';
import { estadoVehiculo } from '@/integraciones/concesionario';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const GET = ruta<{ referencia: string }>(['concesionario', ...PERSONAL], async ({ params }) =>
  estadoVehiculo(decodeURIComponent(params.referencia)),
);
