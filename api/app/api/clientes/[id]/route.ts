import { editarClienteDto } from '@/clientes/dto';
import { editarCliente, unCliente } from '@/clientes/clientes.service';
import { ruta } from '@/comun/guardia';
import { entero, leerCuerpo } from '@/comun/http';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const GET = ruta<{ id: string }>(PERSONAL, async ({ params }) => unCliente(entero(params.id)));

export const PATCH = ruta<{ id: string }>(PERSONAL, async ({ req, params }) =>
  editarCliente(entero(params.id), await leerCuerpo(req, editarClienteDto)),
);
