import type { AxiosInstance } from 'axios';
import type { Deps } from '@arsi/container';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@arsi/container', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@arsi/container')>();
  return { ...actual, isDev: false };
});

async function loadInit() {
  vi.resetModules();
  const mod = await import('./index');
  return mod.default;
}

function createFakeDeps() {
  const apiRegistry = {
    register: vi.fn<(name: string, instance: AxiosInstance) => void>(),
    get: vi.fn(),
    has: vi.fn(),
  };
  const menu = { register: vi.fn(), getAll: vi.fn(() => []) };
  const routes = {
    add: vi.fn(),
    override: vi.fn(),
    getRoutes: vi.fn(() => []),
    has: vi.fn(),
  };
  const modal = {
    register: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    isOpen: vi.fn(),
    getSnapshot: vi.fn(),
    getComponent: vi.fn(),
    subscribe: vi.fn(),
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

  const deps = {
    config: { client: 'test', modules: [], apiBase: 'https://example.test', featureFlags: {} },
    logger,
    apiRegistry,
    menu,
    routes,
    modal,
    events,
    i18n,
  };

  return { deps: deps as unknown as Deps, apiRegistry, menu, routes, modal, events, i18n, logger };
}

describe('module-sample init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers i18n, service client, menu, routes, modal and event listener', async () => {
    const { deps, apiRegistry, menu, routes, modal, events, i18n } = createFakeDeps();
    const init = await loadInit();

    await init(deps);

    expect(i18n.addResourceBundle).toHaveBeenCalledWith(
      'en',
      'module-sample',
      expect.anything(),
      true,
      true,
    );
    expect(apiRegistry.register).toHaveBeenCalledWith('module-sample', expect.anything());
    const client = apiRegistry.register.mock.calls[0][1] as AxiosInstance;
    expect(client.defaults.baseURL).toBe('https://example.test');
    expect(menu.register).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/module-sample', order: 30 }),
    );
    expect(routes.add).toHaveBeenCalledTimes(12);
    expect(routes.add).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/module-sample/query' }),
    );
    expect(modal.register).toHaveBeenCalledWith('module-sample.info', expect.anything());
    expect(events.on).toHaveBeenCalledWith('module-sample.sample.postCreated', expect.any(Function));
  });

  it('is idempotent so React StrictMode double-invocation is safe', async () => {
    const { deps, apiRegistry, routes, menu } = createFakeDeps();
    const init = await loadInit();

    await init(deps);
    await init(deps);

    expect(apiRegistry.register).toHaveBeenCalledTimes(1);
    expect(menu.register).toHaveBeenCalledTimes(1);
    expect(routes.add).toHaveBeenCalledTimes(12);
  });
});
