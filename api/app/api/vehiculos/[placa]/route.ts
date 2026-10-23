import { editarVehiculoDto } from '@/clientes/dto';
import { editarVehiculo, vehiculoPorPlaca } from '@/clientes/clientes.service';
import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const GET = ruta<{ placa: string }>(PERSONAL, async ({ params }) => vehiculoPorPlaca(params.placa));

export const PATCH = ruta<{ placa: string }>(PERSONAL, async ({ req, params }) =>
  editarVehiculo(params.placa, await leerCuerpo(req, editarVehiculoDto)),
);
