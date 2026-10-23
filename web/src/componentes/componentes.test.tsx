import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { actorDe, renderizar } from '../pruebas/utilidades';
import { BarraNav } from './BarraNav';
import { Boton } from './Boton';
import { Entrada } from './Campos';
import { EstadoOrden, Etiqueta } from './Etiqueta';
import { Celda, Fila, Tabla } from './Tabla';

describe('componentes del sistema de diseño', () => {
  it('el estado de la orden sale en Mono con su tono', () => {
    render(<EstadoOrden estado="en_reparacion" />);
    const etiqueta = screen.getByText('En reparación');
    expect(etiqueta).toHaveClass('mono');
    expect(etiqueta).toHaveAttribute('data-tono', 'vivo');
  });

  it('el pulso usa naranja para vivo y verde para listo, nunca otro color', () => {
    const { container } = render(
      <>
        <Etiqueta tono="vivo">A</Etiqueta>
        <Etiqueta tono="listo">B</Etiqueta>
        <Etiqueta tono="neutro">C</Etiqueta>
      </>,
    );
    const puntos = container.querySelectorAll('[aria-hidden]');
    expect(puntos[0]).toHaveClass('bg-signal-orange');
    expect(puntos[1]).toHaveClass('bg-metric-green');
    expect(puntos[2]).toHaveClass('bg-warm-granite');
  });

  it('los botones tienen radio de 3 px y nunca se rellenan con color de marca', () => {
    render(
      <>
        <Boton>Oscuro</Boton>
        <Boton variante="claro">Claro</Boton>
        <Boton variante="fantasma" sobre="claro">
          Fantasma
        </Boton>
      </>,
    );
    for (const nombre of ['Oscuro', 'Claro', 'Fantasma']) {
      const boton = screen.getByRole('button', { name: nombre });
      expect(boton).toHaveClass('rounded-sm');
      expect(boton.className).not.toMatch(/bg-(signal-orange|metric-green)/);
    }
    expect(screen.getByRole('button', { name: 'Claro' })).toHaveClass('bg-chalk', 'text-obsidian-canvas');
    expect(screen.getByRole('button', { name: 'Oscuro' })).toHaveAttribute('type', 'button');
  });

  it('el campo asocia su etiqueta con el input', async () => {
    render(<Entrada etiqueta="Placa" />);
    await userEvent.type(screen.getByLabelText('Placa'), 'ABC123');
    expect(screen.getByLabelText('Placa')).toHaveValue('ABC123');
  });

  it('la tabla muestra el mensaje de vacía', () => {
    render(<Tabla columnas={['A']} vacia="Nada por aquí">{[]}</Tabla>);
    expect(screen.getByText('Nada por aquí')).toBeInTheDocument();
  });

  it('la tabla con filas no muestra el mensaje de vacía', () => {
    render(
      <Tabla columnas={['A']} vacia="Nada por aquí">
        {[
          <Fila key="1">
            <Celda>uno</Celda>
          </Fila>,
        ]}
      </Tabla>,
    );
    expect(screen.queryByText('Nada por aquí')).not.toBeInTheDocument();
  });
});

describe('barra de navegación', () => {
  it('el mecánico solo ve sus enlaces', async () => {
    renderizar(<BarraNav />, { actor: actorDe('mecanico') });
    await waitFor(() => expect(screen.getByRole('link', { name: 'Mis trabajos' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clientes' })).not.toBeInTheDocument();
  });

  it('el administrador ve usuarios, roles e integraciones', async () => {
    renderizar(<BarraNav />, { actor: actorDe('administrador') });
    await waitFor(() => expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Roles' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Integraciones' })).toBeInTheDocument();
  });

  it('salir cierra la sesión', async () => {
    renderizar(<BarraNav />, { actor: actorDe('recepcionista') });
    await userEvent.click(await screen.findByRole('button', { name: 'Salir' }));
    expect(sessionStorage.getItem('taller.token')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salir' })).not.toBeInTheDocument();
  });
});
