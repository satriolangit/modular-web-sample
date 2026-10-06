import { describe, expect, it, vi } from 'vitest';

import type { Deps } from '@arsi/container';

function createFakeDeps(registryAdminUrl = 'http://localhost:4310') {
  return {
    config: { client: 'test', modules: ['registry-admin'], apiBase: '', registryAdminUrl },
    apiRegistry: { register: vi.fn() },
    routes: { add: vi.fn() },
    menu: { register: vi.fn() },
    i18n: { addResourceBundle: vi.fn() },
  } as unknown as Deps;
}

async function loadInit() {
  vi.resetModules();
  const module = await import('../index');
  return module.default;
}

describe('registry-admin init', () => {
  it('mendaftarkan service, route, menu, dan i18n', async () => {
    const deps = createFakeDeps();
    const init = await loadInit();
    await init(deps);

    expect(deps.apiRegistry.register).toHaveBeenCalledWith('registry-admin', expect.anything());
    expect(deps.routes.add).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/system/modules', meta: expect.objectContaining({ module: 'registry-admin' }) }),
    );
    expect(deps.menu.register).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/system/modules' }),
    );
    expect(deps.i18n.addResourceBundle).toHaveBeenCalledTimes(2);
  });

  it('tidak mendaftarkan service bila URL kosong', async () => {
    const deps = createFakeDeps('');
    const init = await loadInit();
    await init(deps);

    expect(deps.apiRegistry.register).not.toHaveBeenCalled();
    expect(deps.routes.add).toHaveBeenCalled();
  });

  it('idempoten saat dipanggil dua kali', async () => {
    const deps = createFakeDeps();
    const init = await loadInit();

    await init(deps);
    await init(deps);

    expect(deps.apiRegistry.register).toHaveBeenCalledTimes(1);
    expect(deps.routes.add).toHaveBeenCalledTimes(1);
    expect(deps.menu.register).toHaveBeenCalledTimes(1);
    expect(deps.i18n.addResourceBundle).toHaveBeenCalledTimes(2);
  });
});
