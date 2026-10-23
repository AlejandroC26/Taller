import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist-mono/400.css';
import './estilos.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app';
import { SesionProvider } from './sesion/sesion';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <BrowserRouter>
      <SesionProvider>
        <App />
      </SesionProvider>
    </BrowserRouter>
  </StrictMode>,
);
