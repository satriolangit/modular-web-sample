#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const modulesDir = fileURLToPath(new URL('../../web-modules/modules', import.meta.url));
const outputPath = fileURLToPath(
  new URL('../src/bootstrap/moduleLoaders.generated.ts', import.meta.url),
);

export function buildModuleLoadersSource(modules) {
  const entries = [...modules]
    .sort((a, b) => a.folder.localeCompare(b.folder))
    .map(({ folder, packageName }) => `  '${folder}': () => import('${packageName}/entry'),`)
    .join('\n');

  return `// AUTO-GENERATED oleh scripts/generate-module-loaders.mjs — JANGAN edit manual.
// Jalankan \`npm run gen:modules\` setelah menambah/menghapus modul (otomatis via pre-hooks).

import type { Deps } from '../di/deps';

export type InitHook = (deps: Deps) => Promise<void> | void;

interface ModuleEntryPoint {
  default: InitHook;
}

export const moduleLoaders: Record<string, () => Promise<ModuleEntryPoint>> = {
${entries}
};
`;
}

export function readWorkspaceModules() {
  return readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = `${modulesDir}/${entry.name}/package.json`;
      if (!existsSync(manifestPath)) {
        console.warn(`[gen:modules] skip "${entry.name}" — tidak ada package.json`);
        return null;
      }

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const expectedName = `@arsi/module-${entry.name}`;
      if (manifest.name !== expectedName) {
        throw new Error(
          `[gen:modules] package.json "${entry.name}" bernama "${manifest.name}" — konvensi wajib "${expectedName}"`,
        );
      }

      return { folder: entry.name, packageName: manifest.name };
    })
    .filter((module) => module !== null);
}

function main() {
  const modules = readWorkspaceModules();
  writeFileSync(outputPath, buildModuleLoadersSource(modules));
  console.log(
    `[gen:modules] OK — ${modules.length} modul → src/bootstrap/moduleLoaders.generated.ts`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
