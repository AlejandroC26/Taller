import { describe, expect, it } from 'vitest';
import { armarCotizacion, manoObraRealizada, mensajeGarantia } from './reglas';
import type { TareaCotizable } from './reglas';

const tarea = (cambios: Partial<TareaCotizable> = {}): TareaCotizable => ({
  id: 1,
  servicioSku: 'FRE-PASTILLAS',
  servicioNombre: 'Cambio de pastillas de freno',
  descripcion: 'Pastillas delanteras',
  precio: 80000,
  causa: 'desgaste_normal',
  garantiaAplica: false,
  garantiaValida: false,
  garantiaRespuesta: 'Desgaste normal: no lo cubre la garantía',
  pagador: 'cliente',
  repuestos: [{ codigoRepuesto: 'PAS-DEL-CER', descripcion: 'Pastillas delanteras', cantidad: 1 }],
  ...cambios,
});

const datos = {
  codigo: 'OT-0001',
  id_relacion: 'REL-1001',
  taller: 'Taller Pulgas Locas',
  sede: 'Pulgas Locas Frenos',
  cliente: { cedula: '1', nombre: 'Laura', telefono: '300' },
  vehiculo: { vin: 'V', placa: 'P', descripcion: 'Duster' },
};

describe('cotización para facturación', () => {
  it('mano de obra con precio y repuestos solo con código y cantidad', () => {
    const c = armarCotizacion(datos, [tarea()]);
    expect(c.mano_obra).toEqual([
      expect.objectContaining({ sku: 'FRE-PASTILLAS', precio: 80000, garantia: expect.objectContaining({ valida: false, pagador: 'cliente' }) }),
    ]);
    expect(c.repuestos).toEqual([
      { tarea_id: 1, codigo_repuesto: 'PAS-DEL-CER', descripcion: 'Pastillas delanteras', cantidad: 1, garantia: expect.any(Object) },
    ]);
    expect(c.repuestos[0]).not.toHaveProperty('precio');
    expect(c).toMatchObject({ total_mano_obra: 80000, total_mano_obra_cliente: 80000, hay_repuestos: true });
  });

  it('sin repuestos va solo la mano de obra', () => {
    const c = armarCotizacion(datos, [tarea({ repuestos: [] })]);
    expect(c.repuestos).toEqual([]);
    expect(c.hay_repuestos).toBe(false);
  });

  it('la garantía válida la paga el responsable y no cuenta para el cliente', () => {
    const c = armarCotizacion(datos, [
      tarea({ causa: 'defecto_fabrica', garantiaAplica: true, garantiaValida: true, garantiaRespuesta: 'Garantía válida', pagador: 'fabricante' }),
      tarea({ id: 2, servicioSku: 'REV-GENERAL', servicioNombre: 'Revisión general', precio: 60000, causa: null, repuestos: [] }),
    ]);
    expect(c.mano_obra[0].garantia).toEqual({ aplica: true, valida: true, pagador: 'fabricante', motivo: 'Garantía válida' });
    expect(c.repuestos[0].garantia.pagador).toBe('fabricante');
    expect(c).toMatchObject({ total_mano_obra: 140000, total_mano_obra_cliente: 60000 });
  });

  it('el mensaje para el cliente dice qué va por garantía y qué no, con motivos', () => {
    expect(mensajeGarantia([tarea({ causa: 'defecto_fabrica', garantiaValida: true, garantiaRespuesta: 'Garantía válida: defecto de fábrica' })])).toMatch(
      /^Va por garantía: Cambio de pastillas de freno \(Garantía válida: defecto de fábrica\)\.$/,
    );
    expect(
      mensajeGarantia([tarea({ causa: 'manipulacion_cliente', garantiaRespuesta: 'Manipulación del cliente: sensor desconectado' })]),
    ).toMatch(/La garantía no es válida para: .*sensor desconectado/);
    expect(mensajeGarantia([tarea()])).toMatch(/desgaste normal/);
    expect(mensajeGarantia([tarea({ causa: null })])).toMatch(/todo lo paga el cliente/);
  });

  it('la mano de obra realizada suma solo lo hecho', () => {
    expect(manoObraRealizada([{ precio: 80000, completada: true }, { precio: 60000, completada: false }])).toBe(80000);
  });
});
