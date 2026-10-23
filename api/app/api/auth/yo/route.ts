import { ruta } from '@/comun/guardia';

export const runtime = 'nodejs';

export const GET = ruta('todos', async ({ actor }) => actor);
