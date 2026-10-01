const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..');

module.exports = {
  '@arsi/module-user-management/entry': path.join(
    workspaceRoot,
    'web-modules',
    'modules',
    'user-management',
    'index.tsx',
  ),
  '@arsi/module-user-management': path.join(
    workspaceRoot,
    'web-modules',
    'modules',
    'user-management',
    'public.ts',
  ),
  '@arsi/module-product-management/entry': path.join(
    workspaceRoot,
    'web-modules',
    'modules',
    'product-management',
    'index.tsx',
  ),
  '@arsi/module-product-management': path.join(
    workspaceRoot,
    'web-modules',
    'modules',
    'product-management',
    'public.ts',
  ),
  '@arsi/module-module-sample/entry': path.join(
    workspaceRoot,
    'web-modules',
    'modules',
    'module-sample',
    'index.tsx',
  ),
  '@arsi/module-module-sample': path.join(
    workspaceRoot,
    'web-modules',
    'modules',
    'module-sample',
    'public.ts',
  ),
  '@arsi/container': path.join(__dirname, 'src', 'public', 'index.ts'),
  '@arsi/shared': path.join(workspaceRoot, 'web-modules', 'shared', 'index.ts'),
  '@arsi/extension': path.join(__dirname, 'current-client', 'src', 'index.tsx'),
};
