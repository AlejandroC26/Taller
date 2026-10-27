// La mano de obra es el precio fijo del SKU de cada servicio (espejo de la API). Los
// repuestos no tienen precio en el taller: los cotiza facturación con las tiendas.
export const totalManoObra = (servicios: { precio: number }[]) =>
  Math.round(servicios.reduce((s, x) => s + (Number(x.precio) || 0), 0) * 100) / 100;
