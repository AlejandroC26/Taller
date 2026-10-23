import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/cliente';

// Carga una ruta de la API y la vuelve a pedir con recargar(). Con ruta null no pide
// nada (por ejemplo, mientras falta un dato).
export function usarDatos<T>(ruta: string | null) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(ruta !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (ruta === null) return;
    let vigente = true;
    setCargando(true);
    api<T>(ruta)
      .then((r) => {
        if (!vigente) return;
        setDatos(r);
        setError(null);
      })
      .catch((e: Error) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [ruta, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { datos, setDatos, error, cargando, recargar };
}

// Ejecuta una acción (guardar, cancelar…) con su estado de ocupado y su error.
export function usarAccion() {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ejecutar = useCallback(async <T,>(accion: () => Promise<T>): Promise<T | undefined> => {
    setOcupado(true);
    setError(null);
    try {
      return await accion();
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    } finally {
      setOcupado(false);
    }
  }, []);
  return { ocupado, error, setError, ejecutar };
}
