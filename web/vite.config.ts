import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// La web habla con la API por el mismo origen: Vite reenvía /api y /mcp a Next.
const API = process.env.TALLER_API_URL ?? 'http://localhost:3417';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  server: {
    port: 5173,
    proxy: { '/api': API, '/mcp': API },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/pruebas/preparar.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
