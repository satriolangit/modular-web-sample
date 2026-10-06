// AUTO-GENERATED oleh scripts/generate-module-loaders.mjs — JANGAN edit manual.
// Jalankan `npm run gen:modules` setelah menambah/menghapus modul (otomatis via pre-hooks).

import type { Deps } from '../di/deps';

export type InitHook = (deps: Deps) => Promise<void> | void;

interface ModuleEntryPoint {
  default: InitHook;
}

export const moduleLoaders: Record<string, () => Promise<ModuleEntryPoint>> = {
  'module-sample': () => import('@arsi/module-module-sample/entry'),
  'product-management': () => import('@arsi/module-product-management/entry'),
  'registry-admin': () => import('@arsi/module-registry-admin/entry'),
  'user-management': () => import('@arsi/module-user-management/entry'),
};
