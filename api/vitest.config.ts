import { defineConfig } from 'vitest/config';

// Pruebas unitarias: no tocan la base de datos. Las reglas viven en funciones puras y
// los services se reemplazan con vi.mock en las pruebas de rutas.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts', 'app/**/*.test.ts'],
    environment: 'node',
  },
});
