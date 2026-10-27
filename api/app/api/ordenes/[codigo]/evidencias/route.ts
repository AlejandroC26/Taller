import { ruta } from '@/comun/guardia';
import { invalido } from '@/comun/errores';
import { guardarEvidencia, listarEvidencias } from '@/diagnosticos/evidencias.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const GET = ruta<{ codigo: string }>(TALLER, async ({ actor, params }) => listarEvidencias(actor, params.codigo));

// Formulario multipart: archivo (foto o PDF, máximo 5 MB) y tareaId opcional.
export const POST = ruta<{ codigo: string }>(
  TALLER,
  async ({ req, actor, params }) => {
    let formulario: FormData;
    try {
      formulario = await req.formData();
    } catch {
      throw invalido('Envíe la evidencia como formulario multipart con el campo archivo');
    }
    const archivo = formulario.get('archivo');
    if (!(archivo instanceof File)) throw invalido('Falta el campo archivo');
    const tareaId = Number(formulario.get('tareaId')) || undefined;
    return guardarEvidencia(actor, params.codigo, {
      nombre: archivo.name,
      datos: new Uint8Array(await archivo.arrayBuffer()),
      tareaId,
    });
  },
  201,
);
