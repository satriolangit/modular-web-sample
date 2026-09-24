import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { bootstrap } from './bootstrap';
import { loadConfig } from './config/loadConfig';
import { AppProviders } from './providers/AppProviders';

import './styles/globals.css';

async function main() {
  const config = await loadConfig();
  const { deps, router } = await bootstrap(config);

  const container = document.getElementById('root');
  if (!container) {
    throw new Error('#root element not found');
  }

  createRoot(container).render(
    <StrictMode>
      <AppProviders deps={deps}>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
}

void main();
