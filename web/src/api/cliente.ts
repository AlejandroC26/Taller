// Cliente de la API: agrega el token, convierte los errores y cierra la sesión si la
// API responde 401.

const LLAVE = 'taller.token';

export const leerToken = () => {
  try {
    return sessionStorage.getItem(LLAVE);
  } catch {
    return null;
  }
};

export const guardarToken = (token: string | null) => {
  try {
    if (token) sessionStorage.setItem(LLAVE, token);
    else sessionStorage.removeItem(LLAVE);
  } catch {
    // Sin almacenamiento (modo privado estricto): la sesión dura lo que la pestaña.
  }
};

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

// La sesión venció o el usuario fue desactivado: la app escucha este evento y sale.
export const SESION_VENCIDA = 'taller:sesion-vencida';

export async function api<T>(
  ruta: string,
  { metodo = 'GET', cuerpo }: { metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; cuerpo?: unknown } = {},
): Promise<T> {
  const token = leerToken();
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'No hay conexión con la API del taller');
  }
  const texto = await respuesta.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = null;
  }
  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) {
      guardarToken(null);
      window.dispatchEvent(new Event(SESION_VENCIDA));
    }
    const mensaje = (json as { message?: string } | null)?.message ?? `Error ${respuesta.status}`;
    throw new ErrorApi(respuesta.status, mensaje);
  }
  return json as T;
}

// Sube un archivo como formulario multipart (por ejemplo, una evidencia).
export async function subirArchivo<T>(ruta: string, formulario: FormData): Promise<T> {
  const token = leerToken();
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formulario });
  } catch {
    throw new ErrorApi(0, 'No hay conexión con la API del taller');
  }
  const json = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, (json as { message?: string } | null)?.message ?? `Error ${respuesta.status}`);
  return json as T;
}

// Descarga un archivo protegido (por ejemplo, una evidencia) para verlo en otra pestaña.
export async function abrirArchivo(ruta: string) {
  const token = leerToken();
  const respuesta = await fetch(ruta, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, 'No se pudo abrir el archivo');
  const url = URL.createObjectURL(await respuesta.blob());
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
