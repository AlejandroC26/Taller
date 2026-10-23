import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { cancelarDto } from '@/ordenes/dto';
import { cancelar } from '@/ordenes/ordenes.service';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Cancela el diagnóstico o la reparación en curso, con el motivo.
export const POST = ruta<{ codigo: string }>(PERSONAL, async ({ req, actor, params }) =>
  cancelar(actor, params.codigo, (await leerCuerpo(req, cancelarDto)).motivo),
);
