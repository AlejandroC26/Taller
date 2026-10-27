import { describe, expect, it } from 'vitest';
import { diagnosticoDto, remitirDto, repuestoDto } from './dto';
import { exigirListoParaFinalizar, MAXIMO_EVIDENCIA, nombreSeguro, tipoPorFirma, validarEvidencia } from './reglas';
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
  it('normaliza SKU y código de repuesto', () => {
    const d = diagnosticoDto.parse({ tareas: [{ sku: 'fre-pastillas', repuestos: [{ codigoRepuesto: 'pas-del-cer', cantidad: 1 }] }] });
    expect(d.tareas[0]).toMatchObject({ sku: 'FRE-PASTILLAS', causa: null, repuestos: [{ codigoRepuesto: 'PAS-DEL-CER' }] });
  });

  it('el repuesto no lleva precio y la cantidad es entera', () => {
    expect(repuestoDto.safeParse({ codigoRepuesto: 'X1', cantidad: 1.5 }).success).toBe(false);
    expect(repuestoDto.parse({ codigoRepuesto: 'X1', cantidad: 2, precio: 9 } as never)).not.toHaveProperty('precio');
  });

  it('remitir exige una nota para el especialista', () => {
    expect(remitirDto.safeParse({ taller: 'PL-FRENOS', nota: 'x' }).success).toBe(false);
    expect(remitirDto.safeParse({ taller: 2, nota: 'Ruido en la rueda delantera' }).success).toBe(true);
  });
});
