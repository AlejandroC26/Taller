import { ruta } from '@/comun/guardia';
import { tokenMcp } from '@/usuarios/usuarios.service';

export const runtime = 'nodejs';

// Token de 7 días para conectar un asistente (o el sistema del concesionario) al MCP.
export const POST = ruta('todos', async ({ actor }) => ({ token: await tokenMcp(actor) }));
