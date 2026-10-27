import { describe, expect, it } from 'vitest';
import { ABIERTOS, CANCELABLES, codigoOrden, ESTADOS, etapaAlTomar, exigirTrabajo, numeroOrden, PASOS, puedePasar, puedeVerOrden, SIGUIENTE } from './reglas';

describe('estados de la orden', () => {
  it('el camino feliz va de agendada a entregada', () => {
    const camino = ['agendada', 'en_diagnostico', 'validando_garantia', 'en_cotizacion', 'aprobada', 'en_reparacion', 'pendiente_facturacion', 'facturada', 'entregada'] as const;
    for (let i = 0; i < camino.length - 1; i++) expect(puedePasar(camino[i], camino[i + 1])).toBe(true);
  });

  it('la remisión vuelve a diagnóstico en la otra sede', () => {
    expect(puedePasar('en_diagnostico', 'remitida')).toBe(true);
    expect(puedePasar('remitida', 'en_diagnostico')).toBe(true);
  });

  it('el rechazo del cliente termina en entrega sin reparar', () => {
    expect(puedePasar('en_cotizacion', 'rechazada')).toBe(true);
    expect(SIGUIENTE.rechazada).toEqual(['entregada']);
  });

  it('no hay atajos: sin pago no sale, sin garantía no se cotiza', () => {
    expect(puedePasar('pendiente_facturacion', 'entregada')).toBe(false);
    expect(puedePasar('en_diagnostico', 'en_cotizacion')).toBe(false);
    expect(puedePasar('agendada', 'en_reparacion')).toBe(false);
  });

  it('se cancela antes de empezar a reparar, nunca después', () => {
    expect(CANCELABLES).toEqual(['agendada', 'en_diagnostico', 'remitida', 'validando_garantia', 'en_cotizacion', 'aprobada']);
    expect(ABIERTOS).not.toContain('entregada');
  });

  it('cada estado le dice al orquestador quién sigue', () => {
    for (const estado of ESTADOS) {
      expect(PASOS[estado].descripcion.length).toBeGreaterThan(5);
      if (SIGUIENTE[estado].length) expect(PASOS[estado].acciones.length).toBeGreaterThan(0);
    }
    expect(PASOS.validando_garantia.responsable).toBe('concesionario');
    expect(PASOS.en_cotizacion.responsable).toBe('facturacion');
    expect(PASOS.pendiente_facturacion.acciones).toContain('registrar_pago');
  });
});

describe('tomar y permisos', () => {
  it('agendada o remitida se toma para diagnosticar; aprobada para reparar', () => {
    expect(etapaAlTomar('agendada', 'OT-1')).toEqual({ etapa: 'diagnostico', pasaA: 'en_diagnostico' });
    expect(etapaAlTomar('remitida', 'OT-1')).toEqual({ etapa: 'diagnostico', pasaA: 'en_diagnostico' });
    expect(etapaAlTomar('aprobada', 'OT-1')).toEqual({ etapa: 'reparacion', pasaA: 'en_reparacion' });
    expect(() => etapaAlTomar('en_cotizacion', 'OT-1')).toThrow(/no hay nada que tomar/);
    // Ya la tomó otro: es un conflicto, no un dato inválido.
    expect(() => etapaAlTomar('en_diagnostico', 'OT-1')).toThrow(expect.objectContaining({ estado: 409 }));
  });

  it('la gestión (administrador y agentes) ve todo; el mecánico, lo suyo y la cola de su sede', () => {
    const ajena = { asignado: false, enMiSede: false, enCola: true };
    expect(puedeVerOrden('agente', ajena)).toBe(true);
    expect(puedeVerOrden('administrador', ajena)).toBe(true);
    expect(puedeVerOrden('mecanico', ajena)).toBe(false);
    expect(puedeVerOrden('mecanico', { asignado: false, enMiSede: true, enCola: true })).toBe(true);
    expect(puedeVerOrden('mecanico', { asignado: false, enMiSede: true, enCola: false })).toBe(false);
    expect(puedeVerOrden('mecanico', { asignado: true, enMiSede: false, enCola: false })).toBe(true);
    expect(puedeVerOrden('visitante', ajena)).toBe(false);
  });

  it('el trabajo lo registra el mecánico asignado o la gestión', () => {
    expect(() => exigirTrabajo('agente', false, 'diagnostico')).not.toThrow();
    expect(() => exigirTrabajo('mecanico', true, 'reparacion')).not.toThrow();
    expect(() => exigirTrabajo('mecanico', false, 'reparacion')).toThrow(/tómela primero/);
  });

  it('códigos OT-0001', () => {
    expect(codigoOrden(7)).toBe('OT-0007');
    expect(numeroOrden('ot-7')).toBe(7);
    expect(numeroOrden('7; DROP TABLE')).toBeNull();
  });
});
