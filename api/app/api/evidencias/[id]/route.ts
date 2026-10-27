import { ruta } from '@/comun/guardia';
import { entero } from '@/comun/http';
import { leerEvidencia } from '@/diagnosticos/evidencias.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Descarga de una evidencia (la usa el concesionario para validar la garantía). Solo
// quien puede ver la orden.
export const GET = ruta<{ id: string }>(TALLER, async ({ actor, params }) => {
  const { nombre, tipo, datos } = await leerEvidencia(actor, entero(params.id));
  return new Response(new Uint8Array(datos), {
    headers: {
      'Content-Type': tipo,
      'Content-Disposition': `inline; filename="${encodeURIComponent(nombre)}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
});
