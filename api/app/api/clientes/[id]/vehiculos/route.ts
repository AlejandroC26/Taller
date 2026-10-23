import { vehiculoDto } from '@/clientes/dto';
import { crearVehiculo } from '@/clientes/clientes.service';
import { ruta } from '@/comun/guardia';
import { entero, leerCuerpo } from '@/comun/http';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const POST = ruta<{ id: string }>(
  PERSONAL,
  async ({ req, params }) => crearVehiculo(entero(params.id), await leerCuerpo(req, vehiculoDto)),
  201,
);
