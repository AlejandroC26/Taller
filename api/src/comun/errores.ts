// Un error de negocio con su código HTTP. Las rutas lo convierten en respuesta y el
// MCP lo devuelve como texto, para que el modelo lo lea y corrija.
export class ErrorHttp extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export const invalido = (mensaje: string) => new ErrorHttp(400, mensaje);
export const noAutorizado = (mensaje: string) => new ErrorHttp(401, mensaje);
export const prohibido = (mensaje: string) => new ErrorHttp(403, mensaje);
export const noEncontrado = (mensaje: string) => new ErrorHttp(404, mensaje);
export const conflicto = (mensaje: string) => new ErrorHttp(409, mensaje);
export const noDisponible = (mensaje: string) => new ErrorHttp(503, mensaje);
