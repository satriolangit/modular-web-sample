import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  buildModuleLoadersSource,
  readWorkspaceModules,
} from '../../scripts/generate-module-loaders.mjs';

const generatedPath = new URL('./moduleLoaders.generated.ts', import.meta.url);

describe('moduleLoaders.generated', () => {
  it('is in sync with web-modules/modules (run `npm run gen:modules`)', () => {
    const expected = buildModuleLoadersSource(readWorkspaceModules());
    const actual = readFileSync(generatedPath, 'utf8');

    expect(actual).toBe(expected);
  });

  it('contains every workspace module', () => {
    const actual = readFileSync(generatedPath, 'utf8');

    for (const module of readWorkspaceModules()) {
      expect(actual).toContain(`'${module.folder}': () => import('${module.packageName}/entry')`);
    }
  });
});
