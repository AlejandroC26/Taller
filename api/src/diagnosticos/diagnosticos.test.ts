import { afterEach, describe, expect, it, vi } from 'vitest';
import { usarTiendas } from '../integraciones/tiendas';
import { REPUESTOS_SIMULADOS } from '../integraciones/tiendas/simulado/datos';
import { tiendaSimulada } from '../integraciones/tiendas/simulado/simulado';
import { copiasDelCatalogo } from './diagnosticos.service';
import { diagnosticoDto, remitirDto, repuestoDto } from './dto';
import { categoriasDe, exigirListoParaFinalizar, filtrarCatalogo, MAXIMO_EVIDENCIA, nombreSeguro, tipoPorFirma, validarEvidencia } from './reglas';
import type { TareaParaFinalizar } from './reglas';

const bytes = (...b: number[]) => new Uint8Array(b);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0);
const PDF = new TextEncoder().encode('%PDF-1.7 contenido');
const WEBP = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');

describe('evidencias', () => {
  it('reconoce el tipo por la firma del archivo', () => {
    expect(tipoPorFirma(PNG)).toBe('image/png');
    expect(tipoPorFirma(JPG)).toBe('image/jpeg');
    expect(tipoPorFirma(PDF)).toBe('application/pdf');
    expect(tipoPorFirma(WEBP)).toBe('image/webp');
    expect(tipoPorFirma(new TextEncoder().encode('<html>'))).toBeNull();
  });

  it('rechaza vacíos, más de 5 MB y tipos no permitidos', () => {
    expect(() => validarEvidencia(new Uint8Array())).toThrow(/vacío/);
    const grande = new Uint8Array(MAXIMO_EVIDENCIA + 1);
    grande.set(PNG);
    expect(() => validarEvidencia(grande)).toThrow(/5 MB/);
    expect(() => validarEvidencia(new TextEncoder().encode('MZ ejecutable'))).toThrow(/Solo se aceptan/);
    expect(validarEvidencia(JPG)).toBe('image/jpeg');
  });

  it('limpia el nombre: sin rutas ni caracteres raros', () => {
    expect(nombreSeguro('../../etc/passwd')).toBe('passwd');
    expect(nombreSeguro('C:\\fotos\\freno <1>.jpg')).toBe('freno _1_.jpg');
  });
});

describe('listo para finalizar', () => {
  const t = (cambios: Partial<TareaParaFinalizar> = {}): TareaParaFinalizar => ({
    id: 1,
    servicioNombre: 'Pastillas',
    causa: 'desgaste_normal',
    garantiaAplica: false,
    garantiaMotivo: 'Desgaste por uso',
    fija: false,
    evidencias: 0,
    ...cambios,
  });

  it('necesita al menos un servicio propio (la revisión fija no cuenta)', () => {
    expect(() => exigirListoParaFinalizar([t({ fija: true })], false, 0)).toThrow(/al menos un servicio/);
  });

  it('cada causa necesita el motivo del dictamen', () => {
    expect(() => exigirListoParaFinalizar([t({ garantiaMotivo: ' ' })], false, 0)).toThrow(/motivo del dictamen/);
  });

  it('si el dictamen aplica, el servicio necesita evidencia', () => {
    expect(() => exigirListoParaFinalizar([t({ causa: 'defecto_fabrica', garantiaAplica: true })], false, 0)).toThrow(/adjunte/);
    expect(() => exigirListoParaFinalizar([t({ causa: 'defecto_fabrica', garantiaAplica: true, evidencias: 1 })], false, 1)).not.toThrow();
  });

  it('si la orden vino por garantía, necesita evidencia aunque el dictamen diga que no aplica', () => {
    expect(() => exigirListoParaFinalizar([t({ causa: 'manipulacion_cliente' })], true, 0)).toThrow(/vino por garantía/);
    expect(() => exigirListoParaFinalizar([t({ causa: 'manipulacion_cliente' })], true, 1)).not.toThrow();
  });
});

describe('validación del diagnóstico', () => {
  it('normaliza el SKU y el código universal del repuesto', () => {
    const d = diagnosticoDto.parse({ tareas: [{ sku: 'fre-pastillas', repuestos: [{ codigoRepuesto: ' pas-del-cer ', cantidad: 1 }] }] });
    expect(d.tareas[0]).toMatchObject({ sku: 'FRE-PASTILLAS', causa: null, repuestos: [{ codigoRepuesto: 'PAS-DEL-CER' }] });
  });

  it('el repuesto no lleva precio, necesita código y la cantidad es entera', () => {
    expect(repuestoDto.safeParse({ codigoRepuesto: 'PAS-DEL-CER', cantidad: 1.5 }).success).toBe(false);
    expect(repuestoDto.safeParse({ codigoRepuesto: ' ', cantidad: 1 }).success).toBe(false);
    expect(repuestoDto.safeParse({ codigoRepuesto: 'X'.repeat(51), cantidad: 1 }).success).toBe(false);
    expect(repuestoDto.parse({ codigoRepuesto: 'PAS-DEL-CER', cantidad: 2, precio: 9 } as never)).not.toHaveProperty('precio');
  });

  it('remitir exige una nota para el especialista', () => {
    expect(remitirDto.safeParse({ taller: 'PL-FRENOS', nota: 'x' }).success).toBe(false);
    expect(remitirDto.safeParse({ taller: 2, nota: 'Ruido en la rueda delantera' }).success).toBe(true);
  });
});

describe('repuestos del catálogo de la tienda', () => {
  const pedido = (...codigos: string[]) =>
    diagnosticoDto.parse({ tareas: [{ sku: 'FRE-PASTILLAS', repuestos: codigos.map((codigoRepuesto) => ({ codigoRepuesto, cantidad: 1 })) }] });
  afterEach(() => usarTiendas(null));

  it('copia nombre y categoría del catálogo, sin precio', async () => {
    usarTiendas(tiendaSimulada());
    expect((await copiasDelCatalogo(pedido('pas-del-cer'), [])).get('PAS-DEL-CER')).toEqual({
      codigoRepuesto: 'PAS-DEL-CER',
      descripcion: 'Juego de pastillas delanteras cerámicas',
      categoria: 'Frenos',
    });
  });

  it('lo ya guardado no se vuelve a pedir a la tienda', async () => {
    const catalogo = vi.fn();
    usarTiendas({ ...tiendaSimulada(), catalogo });
    const guardado = { codigoRepuesto: 'PAS-DEL-CER', descripcion: 'x', categoria: 'Frenos' };
    await copiasDelCatalogo(pedido('PAS-DEL-CER'), [guardado as never]);
    expect(catalogo).not.toHaveBeenCalled();
  });

  it('un código que no está en el catálogo responde 400; sin respuesta de la tienda, 503', async () => {
    usarTiendas(tiendaSimulada());
    await expect(copiasDelCatalogo(pedido('NO-EXISTE'), [])).rejects.toMatchObject({ estado: 400 });
    usarTiendas({ ...tiendaSimulada(), catalogo: async () => ({ repuestos: [], sin_respuesta: ['Tienda de repuestos'], actualizado_en: null }) });
    await expect(copiasDelCatalogo(pedido('PAS-DEL-CER'), [])).rejects.toMatchObject({ estado: 503 });
  });

  it('filtra el catálogo por texto sin tildes y por categoría', () => {
    expect(filtrarCatalogo(REPUESTOS_SIMULADOS, 'pastillas').map((r) => r.codigo_repuesto)).toEqual(['PAS-DEL-CER', 'PAS-TRA-CER']);
    expect(filtrarCatalogo(REPUESTOS_SIMULADOS, 'bateria').map((r) => r.codigo_repuesto)).toEqual(['BAT-12V-60AH']);
    expect(filtrarCatalogo(REPUESTOS_SIMULADOS, undefined, 'suspension').map((r) => r.codigo_repuesto)).toEqual(['AMO-DEL-GAS', 'AMO-TRA-GAS']);
    expect(categoriasDe(REPUESTOS_SIMULADOS)).toContain('Frenos');
  });
});
