import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/sometype-mono/400.css';
import '@fontsource/sometype-mono/500.css';
import './estilos.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app';
import { SesionProvider } from './sesion/sesion';
import { TemaProvider } from './tema/tema';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <TemaProvider>
      <BrowserRouter>
        <SesionProvider>
          <App />
        </SesionProvider>
      </BrowserRouter>
    </TemaProvider>
  </StrictMode>,
);
