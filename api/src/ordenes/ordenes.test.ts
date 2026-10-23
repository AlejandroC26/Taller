import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { actorDe } from '../comun/pruebas';
import { asignarDto, cancelarDto, estadoDto, nuevaOrdenDto } from './dto';
import type { Orden } from './orden.entity';
import { transicionar } from './ordenes.service';
import {
  ABIERTOS,
  cargaPorMecanico,
  codigoOrden,
  estadoTrasAsignar,
  etapaActual,
  exigirTransicion,
  exigirTrabajo,
  numeroOrden,
  puedePasar,
  puedeVerOrden,
} from './reglas';

describe('estados de la orden', () => {
  it('sigue el flujo recibido → … → entregado', () => {
    const flujo = ['recibido', 'en_diagnostico', 'diagnosticado', 'aprobado', 'en_reparacion', 'terminado', 'entregado'] as const;
    for (let i = 0; i < flujo.length - 1; i++) expect(puedePasar(flujo[i], flujo[i + 1])).toBe(true);
  });

  it('no permite saltarse pasos', () => {
    expect(puedePasar('recibido', 'en_reparacion')).toBe(false);
    expect(puedePasar('en_diagnostico', 'aprobado')).toBe(false);
    expect(() => exigirTransicion('recibido', 'terminado', 'OT-0001')).toThrow(/OT-0001 está recibido: no puede pasar a terminado/);
  });

  it('se cancela en cualquier estado antes de terminar, nunca después', () => {
    for (const estado of ['recibido', 'en_diagnostico', 'diagnosticado', 'aprobado', 'en_reparacion'] as const) {
      expect(puedePasar(estado, 'cancelado')).toBe(true);
    }
    expect(puedePasar('terminado', 'cancelado')).toBe(false);
    expect(puedePasar('entregado', 'cancelado')).toBe(false);
    expect(puedePasar('cancelado', 'recibido')).toBe(false);
  });

  it('las órdenes abiertas excluyen entregadas y canceladas', () => {
    expect(ABIERTOS).not.toContain('entregado');
    expect(ABIERTOS).not.toContain('cancelado');
    expect(ABIERTOS).toContain('terminado');
  });
});

describe('códigos de orden', () => {
  it('formatea OT-0001', () => {
    expect(codigoOrden(1)).toBe('OT-0001');
    expect(codigoOrden(12345)).toBe('OT-12345');
  });

  it('acepta varias formas y rechaza basura', () => {
    expect(numeroOrden('OT-0007')).toBe(7);
    expect(numeroOrden('ot7')).toBe(7);
    expect(numeroOrden(' 7 ')).toBe(7);
    expect(numeroOrden('OT-0')).toBeNull();
    expect(numeroOrden("1; DROP TABLE ordenes")).toBeNull();
  });
});

describe('asignación de mecánicos', () => {
  it('asignar diagnóstico a una orden recibida la pasa a en diagnóstico', () => {
    expect(estadoTrasAsignar('recibido', 'diagnostico', 'OT-1')).toBe('en_diagnostico');
    expect(estadoTrasAsignar('en_diagnostico', 'diagnostico', 'OT-1')).toBe('en_diagnostico');
  });

  it('la reparación solo se asigna con el diagnóstico aprobado', () => {
    expect(estadoTrasAsignar('aprobado', 'reparacion', 'OT-1')).toBe('en_reparacion');
    expect(() => estadoTrasAsignar('diagnosticado', 'reparacion', 'OT-1')).toThrow(/aprobado o en_reparacion/);
    expect(() => estadoTrasAsignar('terminado', 'diagnostico', 'OT-1')).toThrow();
  });

  it('la etapa actual sale del estado', () => {
    expect(etapaActual('en_diagnostico')).toBe('diagnostico');
    expect(etapaActual('en_reparacion')).toBe('reparacion');
    expect(etapaActual('aprobado')).toBeNull();
  });

  it('la disponibilidad cuenta órdenes abiertas por mecánico y ordena por carga', () => {
    const mecanicos = [
      { id: 'a', nombre: 'Ana', apellido: 'R' },
      { id: 'b', nombre: 'Beto', apellido: 'S' },
      { id: 'c', nombre: 'Caro', apellido: 'T' },
    ];
    const carga = cargaPorMecanico(mecanicos, [
      { mecanicoId: 'a', ordenId: 1, estado: 'en_reparacion', etapa: 'reparacion' },
      { mecanicoId: 'a', ordenId: 1, estado: 'en_reparacion', etapa: 'diagnostico' },
      { mecanicoId: 'a', ordenId: 2, estado: 'en_diagnostico', etapa: 'diagnostico' },
      { mecanicoId: 'b', ordenId: 3, estado: 'entregado', etapa: 'reparacion' },
    ]);
    expect(carga.map((m) => [m.id, m.carga, m.disponible])).toEqual([
      ['b', 0, true],
      ['c', 0, true],
      ['a', 2, false],
    ]);
    expect(carga[2].ordenes[0]).toEqual({ codigo: 'OT-0001', estado: 'en_reparacion', etapa: 'reparacion' });
  });
});

describe('permisos sobre una orden', () => {
  it('el personal ve todas; el mecánico solo las asignadas; el concesionario las suyas', () => {
    expect(puedeVerOrden('recepcionista', { asignado: false, origen: 'taller' })).toBe(true);
    expect(puedeVerOrden('administrador', { asignado: false, origen: 'taller' })).toBe(true);
    expect(puedeVerOrden('mecanico', { asignado: true, origen: 'taller' })).toBe(true);
    expect(puedeVerOrden('mecanico', { asignado: false, origen: 'taller' })).toBe(false);
    expect(puedeVerOrden('concesionario', { asignado: false, origen: 'concesionario' })).toBe(true);
    expect(puedeVerOrden('concesionario', { asignado: false, origen: 'taller' })).toBe(false);
    expect(puedeVerOrden('rol_nuevo', { asignado: true, origen: 'taller' })).toBe(false);
  });

  it('el trabajo lo registra el mecánico asignado a la etapa o el administrador', () => {
    expect(() => exigirTrabajo('mecanico', true, 'diagnostico')).not.toThrow();
    expect(() => exigirTrabajo('administrador', false, 'reparacion')).not.toThrow();
    expect(() => exigirTrabajo('mecanico', false, 'reparacion')).toThrow(/No está asignado a la etapa de reparacion/);
    expect(() => exigirTrabajo('recepcionista', false, 'diagnostico')).toThrow(/mecánico asignado/);
  });
});

describe('validación de órdenes', () => {
  it('normaliza la placa y exige un motivo', () => {
    expect(nuevaOrdenDto.parse({ placa: 'abc-123', motivo: 'Ruido al frenar' }).placa).toBe('ABC123');
    expect(nuevaOrdenDto.safeParse({ placa: 'ABC123', motivo: '' }).success).toBe(false);
  });

  it('por la ruta de estado solo se aprueba o se entrega', () => {
    expect(estadoDto.safeParse({ estado: 'aprobado' }).success).toBe(true);
    expect(estadoDto.safeParse({ estado: 'terminado' }).success).toBe(false);
  });

  it('cancelar exige motivo; asignar exige un mecánico válido', () => {
    expect(cancelarDto.safeParse({ motivo: 'no' }).success).toBe(false);
    expect(asignarDto.safeParse({ mecanicoId: 'x', etapa: 'diagnostico' }).success).toBe(false);
    expect(
      asignarDto.safeParse({ mecanicoId: '7c9e6679-7425-40de-944b-e07fc1f90ae7', etapa: 'reparacion' }).success,
    ).toBe(true);
  });
});

describe('transicionar', () => {
  const gestor = () =>
    ({
      update: vi.fn(),
      create: vi.fn((_c: unknown, d: unknown) => d),
      save: vi.fn(async (d: unknown) => d),
    }) as unknown as EntityManager & Record<'update' | 'create' | 'save', ReturnType<typeof vi.fn>>;

  const orden = (origen: 'taller' | 'concesionario') =>
    ({
      id: 9,
      estado: 'diagnosticado',
      origen,
      historial: [{ estado: 'recibido', fecha: 'x', usuario: 'y' }],
      vehiculo: { placa: 'ABC123', referenciaExterna: 'CON-77' },
    }) as unknown as Orden;

  it('cambia el estado y agrega el paso a la línea de tiempo', async () => {
    const tx = gestor();
    const o = orden('taller');
    await transicionar(tx, o, 'aprobado', actorDe('recepcionista'), 'El cliente aceptó');
    expect(o.estado).toBe('aprobado');
    expect(o.historial).toHaveLength(2);
    expect(o.historial[1]).toMatchObject({ estado: 'aprobado', usuario: 'recepcionista Prueba', nota: 'El cliente aceptó' });
    expect(tx.update).toHaveBeenCalledWith(expect.anything(), 9, { estado: 'aprobado', historial: o.historial });
    // Un carro del taller no avisa a nadie.
    expect(tx.save).not.toHaveBeenCalled();
  });

  it('si el carro es del concesionario, deja el aviso en la bandeja de salida', async () => {
    const tx = gestor();
    await transicionar(tx, orden('concesionario'), 'aprobado', actorDe('recepcionista'));
    expect(tx.save).toHaveBeenCalledWith(
      expect.objectContaining({
        destino: 'concesionario',
        herramienta: 'notificar_estado_vehiculo',
        datos: expect.objectContaining({ referencia_externa: 'CON-77', orden: 'OT-0009', estado: 'aprobado' }),
      }),
    );
  });

  it('un cambio no permitido no toca la base', async () => {
    const tx = gestor();
    await expect(transicionar(tx, orden('taller'), 'entregado', actorDe('recepcionista'))).rejects.toMatchObject({ estado: 400 });
    expect(tx.update).not.toHaveBeenCalled();
  });
});
