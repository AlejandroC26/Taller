import { ruta } from '@/comun/guardia';
import { invalido } from '@/comun/errores';
import { buscarParte } from '@/integraciones/partes';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Busca una pieza en el proyecto de partes: ?buscar=sensor de oxígeno
export const GET = ruta(TALLER, async ({ url }) => {
  const texto = url.searchParams.get('buscar')?.trim();
  if (!texto) throw invalido('Escriba qué parte busca');
  return buscarParte(texto.slice(0, 120));
});
