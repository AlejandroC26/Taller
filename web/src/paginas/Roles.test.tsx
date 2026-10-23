import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { actorDe, renderizar } from '../pruebas/utilidades';
import { Roles } from './Roles';

const roles = [
  { id: 1, nombre: 'administrador', descripcion: 'Acceso total', usuarios: 1 },
  { id: 3, nombre: 'mecanico', descripcion: 'Repara', usuarios: 2 },
];

describe('roles', () => {
  it('lista los roles fijos con su nombre en español y sin opción de crear ni borrar', async () => {
    renderizar(<Roles />, { actor: actorDe('administrador'), rutas: { 'GET /api/roles': roles } });
    expect(await screen.findByText('Mecánico')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /borrar/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
  });

  it('editar la descripción la guarda con PATCH', async () => {
    const { llamadas } = renderizar(<Roles />, {
      actor: actorDe('administrador'),
      rutas: { 'GET /api/roles': roles, 'PATCH /api/roles/3': { ...roles[1], descripcion: 'Diagnostica y repara' } },
    });
    const campo = await screen.findByLabelText('Descripción de mecanico');
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Diagnostica y repara');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({ descripcion: 'Diagnostica y repara' });
  });
});
