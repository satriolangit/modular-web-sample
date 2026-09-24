import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { LoginPage } from '../auth/LoginPage';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import type { AppConfig } from '../config/types';
import { createDeps, type Deps } from '../di/deps';
import { AppShell } from '../layout/AppShell';
import { HomePage } from '../layout/HomePage';
import { NotFoundPage } from '../layout/NotFoundPage';
import { RouteErrorPage } from '../layout/RouteErrorPage';
import { discover } from './discover';

export interface BootstrapResult {
  deps: Deps;
  router: ReturnType<typeof createBrowserRouter>;
}

async function runBootstrap(config: AppConfig): Promise<BootstrapResult> {
  const deps = createDeps(config);
  await discover(deps);

  const moduleRoutes: RouteObject[] = deps.routes.getRoutes().map(({ path, element, meta }) => ({
    path: path.replace(/^\//, ''),
    element,
    handle: meta,
  }));

  const router = createBrowserRouter([
    { path: '/login', element: <LoginPage /> },
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      ),
      errorElement: <RouteErrorPage />,
      children: [{ index: true, element: <HomePage /> }, ...moduleRoutes],
    },
    { path: '*', element: <NotFoundPage /> },
  ]);

  return { deps, router };
}

let bootstrapPromise: Promise<BootstrapResult> | null = null;

export function bootstrap(config: AppConfig): Promise<BootstrapResult> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap(config);
  }
  return bootstrapPromise;
}
