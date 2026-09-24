const preset = require('../web-modules/shared/tailwind.preset.cjs');

module.exports = {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './current-client/src/**/*.{ts,tsx}',
    '../web-modules/shared/**/*.{ts,tsx}',
    '../web-modules/modules/**/*.{ts,tsx}',
    '!../web-modules/shared/**/node_modules/**',
    '!../web-modules/modules/**/node_modules/**',
  ],
};
