import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Entrar } from '../paginas/Entrar';
import { actorDe, renderizar } from '../pruebas/utilidades';
import { RutaProtegida } from './sesion';

describe('ruta protegida', () => {
  it('sin sesión lleva a la pantalla de entrada', async () => {
    renderizar(
      <RutaProtegida>
        <p>Contenido privado</p>
      </RutaProtegida>,
    );
    expect(await screen.findByText('Pantalla de entrada')).toBeInTheDocument();
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument();
  });

  it('con sesión muestra el contenido', async () => {
    renderizar(
      <RutaProtegida>
        <p>Contenido privado</p>
      </RutaProtegida>,
      { actor: actorDe('recepcionista') },
    );
    expect(await screen.findByText('Contenido privado')).toBeInTheDocument();
  });

  it('sin el permiso lleva a la pantalla de inicio del rol', async () => {
    renderizar(
      <RutaProtegida permitido={(rol) => rol === 'administrador'}>
        <p>Solo administración</p>
      </RutaProtegida>,
      { actor: actorDe('mecanico') },
    );
    expect(await screen.findByText('Pantalla de mis trabajos')).toBeInTheDocument();
  });

  it('un token vencido (401 en /yo) lleva a entrar', async () => {
    sessionStorage.setItem('taller.token', 'vencido');
    renderizar(
      <RutaProtegida>
        <p>Contenido privado</p>
      </RutaProtegida>,
    );
    expect(await screen.findByText('Pantalla de entrada')).toBeInTheDocument();
  });
});

describe('pantalla de entrada', () => {
  it('con credenciales válidas guarda el token y va al inicio del rol', async () => {
    const { llamadas } = renderizar(<Entrar />, {
      rutas: { 'POST /api/auth/entrar': { token: 'nuevo-token', usuario: actorDe('mecanico') } },
    });
    await userEvent.type(screen.getByLabelText('Usuario'), 'mario');
    await userEvent.type(screen.getByLabelText('Clave'), 'clave-segura-1');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Pantalla de mis trabajos')).toBeInTheDocument();
    expect(sessionStorage.getItem('taller.token')).toBe('nuevo-token');
    expect(llamadas.find((l) => l.url === '/api/auth/entrar')?.cuerpo).toEqual({ usuario: 'mario', clave: 'clave-segura-1' });
  });

  it('con credenciales erradas muestra el mensaje de la API', async () => {
    renderizar(<Entrar />, {
      rutas: { 'POST /api/auth/entrar': { estado: 401, json: { message: 'Usuario o clave incorrectos' } } },
    });
    await userEvent.type(screen.getByLabelText('Usuario'), 'x');
    await userEvent.type(screen.getByLabelText('Clave'), 'y');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o clave incorrectos');
    expect(sessionStorage.getItem('taller.token')).toBeNull();
  });
});
