import { ruta } from '@/comun/guardia';
import { listarItems } from '@/inventario/inventario.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Ítems con existencias en o por debajo de su nivel de alerta.
export const GET = ruta(TALLER, async () => listarItems({ soloAlertas: true }));
