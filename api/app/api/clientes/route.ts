import { clienteDto } from '@/clientes/dto';
import { crearCliente, listarClientes } from '@/clientes/clientes.service';
import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// ?buscar= busca por nombre, documento o placa.
export const GET = ruta(PERSONAL, async ({ url }) =>
  listarClientes(url.searchParams.get('buscar') ?? undefined),
);

export const POST = ruta(PERSONAL, async ({ req }) => crearCliente(await leerCuerpo(req, clienteDto)), 201);
