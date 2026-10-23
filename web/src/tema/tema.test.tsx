import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { InterruptorTema, LLAVE_TEMA, TemaProvider, temaGuardado } from './tema';

const montar = () =>
  render(
    <TemaProvider>
      <InterruptorTema />
    </TemaProvider>,
  );

describe('tema claro y oscuro', () => {
  it('sin elección guardada empieza en claro (el tema de DESIGN.md)', () => {
    expect(temaGuardado()).toBe('claro');
    montar();
    expect(document.documentElement.dataset.tema).toBe('claro');
    expect(screen.getByRole('switch', { name: 'Tema oscuro' })).toHaveAttribute('aria-checked', 'false');
  });

  it('el interruptor cambia a oscuro, lo aplica en <html> y lo recuerda', async () => {
    montar();
    await userEvent.click(screen.getByRole('switch', { name: 'Tema oscuro' }));
    expect(document.documentElement.dataset.tema).toBe('oscuro');
    expect(localStorage.getItem(LLAVE_TEMA)).toBe('oscuro');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('switch'));
    expect(document.documentElement.dataset.tema).toBe('claro');
  });

  it('respeta el tema guardado al volver', () => {
    localStorage.setItem(LLAVE_TEMA, 'oscuro');
    montar();
    expect(document.documentElement.dataset.tema).toBe('oscuro');
  });

  it('un valor inválido guardado vuelve a claro', () => {
    localStorage.setItem(LLAVE_TEMA, 'morado');
    expect(temaGuardado()).toBe('claro');
  });
});
