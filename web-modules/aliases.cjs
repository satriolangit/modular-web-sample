const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..');

module.exports = {
  // Alias per modul tidak diperlukan — loader map di-generate dari package.json name.
  '@arsi/container': path.join(workspaceRoot, 'web-container', 'src', 'public', 'index.ts'),
  '@arsi/shared': path.join(__dirname, 'shared', 'index.ts'),
};
