import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { actorDe, renderizar } from '../pruebas/utilidades';
import { GrupoAvatares, iniciales } from './Avatar';
import { BarraNav } from './BarraNav';
import { Logo, Marca } from './Marca';
import { Boton } from './Boton';
import { Entrada } from './Campos';
import { EstadoOrden, Etiqueta } from './Etiqueta';
import { Celda, Fila, Tabla } from './Tabla';

describe('componentes del sistema de diseño', () => {
  it('el estado de la orden es una píldora con su tono', () => {
    render(<EstadoOrden estado="en_reparacion" />);
    const etiqueta = screen.getByText('En reparación');
    expect(etiqueta).toHaveClass('rounded-full', 'bg-signal-blue', 'text-signal-white');
    expect(etiqueta).toHaveAttribute('data-tono', 'progreso');
  });

  it('cada tono usa su color de DESIGN.md', () => {
    render(
      <>
        <Etiqueta tono="listo">Hecho</Etiqueta>
        <Etiqueta tono="revision">Por aprobar</Etiqueta>
        <Etiqueta tono="alerta">Reponer</Etiqueta>
        <Etiqueta>Recibido</Etiqueta>
      </>,
    );
    expect(screen.getByText('Hecho')).toHaveClass('bg-mint', 'text-ink-black');
    expect(screen.getByText('Por aprobar')).toHaveClass('bg-brand-violet');
    expect(screen.getByText('Reponer')).toHaveClass('bg-alerta');
    expect(screen.getByText('Recibido')).toHaveAttribute('data-tono', 'neutro');
  });

  it('los botones son píldoras y ninguno se rellena con violeta ni azul', () => {
    render(
      <>
        <Boton variante="primario">Primario</Boton>
        <Boton>Contorno</Boton>
        <Boton variante="azul">Azul</Boton>
        <Boton variante="suave">Suave</Boton>
      </>,
    );
    for (const nombre of ['Primario', 'Contorno', 'Azul', 'Suave']) {
      const boton = screen.getByRole('button', { name: nombre });
      expect(boton).toHaveClass('rounded-full', 'font-bold');
      // Un hover sutil (hover:bg-signal-blue/5) no es relleno: se comparan clases enteras.
      const clases = boton.className.split(' ');
      expect(clases).not.toContain('bg-brand-violet');
      expect(clases).not.toContain('bg-signal-blue');
    }
    expect(screen.getByRole('button', { name: 'Primario' })).toHaveClass('bg-accion', 'text-accion-texto');
    expect(screen.getByRole('button', { name: 'Contorno' })).toHaveAttribute('data-variante', 'contorno');
    expect(screen.getByRole('button', { name: 'Contorno' })).toHaveAttribute('type', 'button');
  });

  it('los avatares muestran iniciales y el grupo no repite personas', () => {
    expect(iniciales('Mario Prueba')).toBe('MP');
    expect(iniciales('ana')).toBe('A');
    render(<GrupoAvatares nombres={['Mario Prueba', 'Nora Díaz', 'Mario Prueba']} />);
    expect(screen.getAllByTitle(/Prueba|Díaz/)).toHaveLength(2);
    expect(screen.getByLabelText('Mario Prueba, Nora Díaz')).toBeInTheDocument();
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

describe('identidad del taller', () => {
  it('la marca muestra el logo y el nombre Pulgas Locas', () => {
    render(<Marca />);
    expect(screen.getByAltText('Logo del Taller Pulgas Locas')).toHaveAttribute('src', '/logo-pulgas-locas.webp');
    expect(screen.getByText('Pulgas Locas')).toBeInTheDocument();
    expect(screen.getByText('Mecánica general')).toBeInTheDocument();
  });

  it('el logo va sobre placa blanca para que no quede un cuadro en el tema oscuro', () => {
    render(<Logo alto={100} />);
    const placa = screen.getByAltText(/Logo del/).parentElement!;
    expect(placa).toHaveClass('bg-signal-white');
    expect(placa).toHaveStyle({ height: '100px', width: '86px' });
  });
});

describe('barra de navegación', () => {
  it('lleva la marca del taller', async () => {
    renderizar(<BarraNav />, { actor: actorDe('recepcionista') });
    expect(await screen.findByAltText('Logo del Taller Pulgas Locas')).toBeInTheDocument();
  });

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
