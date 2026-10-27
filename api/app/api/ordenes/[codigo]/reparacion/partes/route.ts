import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { parteDto } from '@/reparaciones/dto';
import { registrarParteUsada } from '@/reparaciones/reparaciones.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Registra lo que se usó y gastó (sin inventario: solo deja constancia).
export const POST = ruta<{ codigo: string }>(
  TALLER,
  async ({ req, actor, params }) => registrarParteUsada(actor, params.codigo, await leerCuerpo(req, parteDto)),
  201,
);
