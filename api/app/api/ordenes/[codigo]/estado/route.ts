import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { estadoDto } from '@/ordenes/dto';
import { cambiarEstado } from '@/ordenes/ordenes.service';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Aprobar el diagnóstico (el cliente aceptó el costo) o entregar el carro.
export const POST = ruta<{ codigo: string }>(PERSONAL, async ({ req, actor, params }) => {
  const { estado, nota } = await leerCuerpo(req, estadoDto);
  return cambiarEstado(actor, params.codigo, estado, nota);
});
