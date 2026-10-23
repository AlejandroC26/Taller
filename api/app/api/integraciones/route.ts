import { ruta } from '@/comun/guardia';
import { estadoIntegraciones } from '@/integraciones/despachador';
import { SOLO_ADMIN } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Qué proyectos externos están conectados y cómo va la bandeja de salida.
export const GET = ruta(SOLO_ADMIN, async () => estadoIntegraciones());
