import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { ingresoDto, registrarIngreso } from '@/integraciones/concesionario';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// El concesionario envía un carro: cliente, vehículo y motivo en una sola petición.
export const POST = ruta(
  ['concesionario', ...PERSONAL],
  async ({ req, actor }) => registrarIngreso(actor, await leerCuerpo(req, ingresoDto)),
  201,
);
