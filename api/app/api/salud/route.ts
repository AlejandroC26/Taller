import { bd } from '@/base-datos/conexion';
import { publica } from '@/comun/guardia';

export const runtime = 'nodejs';

export const GET = publica(async () => {
  await (await bd()).query('SELECT 1');
  return { estado: 'ok', baseDatos: 'conectada' };
});
