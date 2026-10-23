import { publica } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { ipDe, limitar } from '@/comun/limite';
import { entrarDto } from '@/usuarios/dto';
import { entrar } from '@/usuarios/usuarios.service';

export const runtime = 'nodejs';

// 10 intentos por minuto por IP, para frenar a quien adivina claves.
export const POST = publica(async (req) => {
  limitar(`entrar:${ipDe(req)}`);
  const { usuario, clave } = await leerCuerpo(req, entrarDto);
  return entrar(usuario, clave);
});
