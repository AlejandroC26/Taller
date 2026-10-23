import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  delete document.documentElement.dataset.tema;
  vi.restoreAllMocks();
});
