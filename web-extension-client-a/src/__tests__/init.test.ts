import type { AxiosInstance } from 'axios';
import type { Deps } from '@arsi/container';
import { sampleSlots } from '@arsi/module-module-sample';
import { userKeys, userSlots } from '@arsi/module-user-management';
import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadInit() {
  vi.resetModules();
  const mod = await import('../index');
  return mod.default;
}

function createFakeDeps({ routeExists = true }: { routeExists?: boolean } = {}) {
  const apiRegistry = {
    register: vi.fn<(name: string, instance: AxiosInstance) => void>(),
    get: vi.fn(),
    has: vi.fn(),
  };
  const slots = {
    register: vi.fn<(name: string, component: unknown) => void>(),
    get: vi.fn(),
    has: vi.fn(),
  };
  const routes = {
    add: vi.fn(),
    override: vi.fn<(path: string, definition: unknown) => void>(),
    getRoutes: vi.fn(() => []),
    has: vi.fn(() => routeExists),
  };
  const events = {
    on: vi.fn<(event: string, handler: (payload: unknown) => void) => () => void>(() => () => {}),
    off: vi.fn(),
    emit: vi.fn(),
    clear: vi.fn(),
  };
  const i18n = { addResourceBundle: vi.fn() };
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
  const queryClient = { invalidateQueries: vi.fn() };
  const deps = {
    config: { client: 'client-a', modules: [], apiBase: '', featureFlags: {} },
    logger,
    apiRegistry,
    slots,
    routes,
    events,
    i18n,
    queryClient,
  };
  return {
    deps: deps as unknown as Deps,
    apiRegistry,
    slots,
    routes,
    events,
    i18n,
    logger,
    queryClient,
  };
}

describe('client-a extension init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers the client-a.audit service with a path-based URL', async () => {
    const { deps, apiRegistry } = createFakeDeps();
    const init = await loadInit();

    await init(deps);

    expect(apiRegistry.register).toHaveBeenCalledWith('client-a.audit', expect.anything());
    const client = apiRegistry.register.mock.calls[0][1] as AxiosInstance;
    expect(client.defaults.baseURL).toBe('/api/audit-client-a');
  });

  it('fills the module slots and overrides routes (tier 1 + 2)', async () => {
    const { deps, slots, routes } = createFakeDeps();
    const init = await loadInit();

    await init(deps);

    expect(slots.register).toHaveBeenCalledWith(userSlots.userTableActions, expect.anything());
    expect(slots.register).toHaveBeenCalledWith(sampleSlots.overviewPanel, expect.anything());
    expect(slots.register).toHaveBeenCalledTimes(2);
    expect(routes.override).toHaveBeenCalledWith(
      '/users/:id',
      expect.objectContaining({ element: expect.anything() }),
    );
    expect(routes.override).toHaveBeenCalledWith(
      '/module-sample/extension-points',
      expect.objectContaining({
        element: expect.anything(),
        meta: { group: 'sample', module: 'module-sample' },
      }),
    );
  });

  it('overrides the module i18n bundle with deep merge', async () => {
    const { deps, i18n } = createFakeDeps();
    const init = await loadInit();

    await init(deps);

    expect(i18n.addResourceBundle).toHaveBeenCalledWith(
      'en',
      'user-management',
      expect.objectContaining({ title: 'Client A Users' }),
      true,
      true,
    );
  });

  it('invalidates the module query cache when the module emits an update', async () => {
    const { deps, events, queryClient } = createFakeDeps();
    const init = await loadInit();

    await init(deps);

    expect(events.on).toHaveBeenCalledWith('user-management.user.updated', expect.any(Function));
    const handler = events.on.mock.calls[0][1];
    handler({ id: 5, changes: {} });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: userKeys.detail(5),
    });
  });

  it('skips route overrides (warn) when the module route is not registered', async () => {
    const { deps, routes, logger } = createFakeDeps({ routeExists: false });
    const init = await loadInit();

    await expect(init(deps)).resolves.toBeUndefined();

    expect(routes.override).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('/users/:id'));
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('/module-sample/extension-points'),
    );
  });

  it('is idempotent so React StrictMode double-invocation is safe', async () => {
    const { deps, apiRegistry, slots, routes } = createFakeDeps();
    const init = await loadInit();

    await init(deps);
    await init(deps);

    expect(apiRegistry.register).toHaveBeenCalledTimes(1);
    expect(slots.register).toHaveBeenCalledTimes(2);
    expect(routes.override).toHaveBeenCalledTimes(2);
  });
});
