import { describe, expect, it } from 'vitest';
import { editarUsuarioDto, entrarDto, nuevoUsuarioDto, rolDto } from './dto';

const valido = {
  nombre: 'Ana',
  apellido: 'Pérez',
  documento: '1020304050',
  telefono: '3001234567',
  usuario: 'Ana.Perez',
  clave: 'clave-segura-1',
  rol: 'mecanico',
};

describe('validación de usuarios', () => {
  it('acepta un usuario completo y deja el usuario en minúsculas', () => {
    const r = nuevoUsuarioDto.parse(valido);
    expect(r.usuario).toBe('ana.perez');
  });

  it('exige una clave de al menos 10 caracteres', () => {
    const r = nuevoUsuarioDto.safeParse({ ...valido, clave: 'corta' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain('10 caracteres');
  });

  it('rechaza documento y teléfono con caracteres inválidos', () => {
    expect(nuevoUsuarioDto.safeParse({ ...valido, documento: '12' }).success).toBe(false);
    expect(nuevoUsuarioDto.safeParse({ ...valido, telefono: 'abc' }).success).toBe(false);
  });

  it('al editar todo es opcional, pero el usuario no se puede cambiar', () => {
    expect(editarUsuarioDto.parse({ activo: false })).toEqual({ activo: false });
    expect(editarUsuarioDto.parse({ usuario: 'otro' })).toEqual({});
  });

  it('el inicio de sesión normaliza el usuario', () => {
    expect(entrarDto.parse({ usuario: ' ADMIN ', clave: 'x' }).usuario).toBe('admin');
  });

  it('el nombre del rol solo admite minúsculas y guion bajo', () => {
    expect(rolDto.parse({ nombre: 'Jefe_Taller' }).nombre).toBe('jefe_taller');
    expect(rolDto.safeParse({ nombre: 'jefe taller' }).success).toBe(false);
  });
});
