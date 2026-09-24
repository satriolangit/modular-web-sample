import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const preset = require('../../../web-modules/shared/tailwind.preset.cjs');

type Table = Record<string, string>;
const HEX: Record<'light' | 'dark', Table> = {
  light: {
    background: '#F8F9FB',
    foreground: '#1F2937',
    card: '#FFFFFF',
    primary: '#551AB9',
    'primary-foreground': '#FFFFFF',
    'primary-hover': '#3D0F8A',
    'primary-light': '#8B5CF6',
    secondary: '#F3F4F6',
    muted: '#F3F4F6',
    'muted-foreground': '#6B7280',
    accent: '#F3EEFC',
    'accent-foreground': '#3D0F8A',
    destructive: '#DC2626',
    'destructive-strong': '#B91C1C',
    success: '#16A34A',
    'success-strong': '#15803D',
    warning: '#F59E0B',
    'warning-strong': '#B45309',
    info: '#0EA5E9',
    'info-strong': '#0369A1',
    border: '#E5E7EB',
    ring: '#551AB9',
  },
  dark: {
    background: '#13111C',
    foreground: '#F3F4F6',
    card: '#1E1B2E',
    primary: '#A78BFA',
    'primary-foreground': '#13111C',
    'primary-hover': '#B9A5FC',
    'primary-light': '#A78BFA',
    secondary: '#2D2A3D',
    muted: '#2D2A3D',
    'muted-foreground': '#9CA3AF',
    accent: '#2A2340',
    'accent-foreground': '#C4B5FD',
    destructive: '#DC2626',
    'destructive-strong': '#F87171',
    success: '#16A34A',
    'success-strong': '#4ADE80',
    warning: '#F59E0B',
    'warning-strong': '#FBBF24',
    info: '#0EA5E9',
    'info-strong': '#38BDF8',
    border: '#2D2A3D',
    ring: '#A78BFA',
  },
};

function parseTokens(block: string): Table {
  const out: Table = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)) {
    out[m[1]] = `${m[2]} ${m[3]}% ${m[4]}%`;
  }
  return out;
}
const light = parseTokens(css.slice(css.indexOf(':root'), css.indexOf('.dark')));
const dark = parseTokens(css.slice(css.indexOf('.dark')));

function hslToHex(hsl: string): string {
  const [hs, ss, ls] = hsl.split(' ');
  const h = Number(hs) / 360;
  const s = parseFloat(ss) / 100;
  const l = parseFloat(ls) / 100;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const REQUIRED = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'primary-hover',
  'primary-light',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'destructive-strong',
  'success',
  'success-foreground',
  'success-strong',
  'warning',
  'warning-foreground',
  'warning-strong',
  'info',
  'info-foreground',
  'info-strong',
  'border',
  'input',
  'ring',
];

describe.each(['light', 'dark'] as const)('%s theme tokens', (themeName) => {
  const tokens = themeName === 'light' ? light : dark;

  it('defines every required token', () => {
    for (const name of REQUIRED) expect(tokens[name], name).toBeDefined();
  });

  it('matches the approved palette (±1 per channel)', () => {
    for (const [name, expected] of Object.entries(HEX[themeName])) {
      const actual = hslToHex(tokens[name]);
      const near = [1, 3, 5].every(
        (i) =>
          Math.abs(parseInt(actual.slice(i, i + 2), 16) - parseInt(expected.slice(i, i + 2), 16)) <=
          1,
      );
      expect(near, `${name}: ${actual} vs ${expected}`).toBe(true);
    }
  });
});

describe('contrast (WCAG)', () => {
  const pairs: Array<[string, string, number]> = [
    ['#1F2937', '#F8F9FB', 4.5],
    ['#6B7280', '#F8F9FB', 4.5],
    ['#FFFFFF', '#551AB9', 4.5],
    ['#3D0F8A', '#F3EEFC', 4.5],
    ['#551AB9', '#FFFFFF', 4.5],
    ['#B91C1C', '#FFFFFF', 4.5],
    ['#15803D', '#FFFFFF', 4.5],
    ['#B45309', '#FFFFFF', 4.5],
    ['#0369A1', '#FFFFFF', 4.5],
    ['#F3F4F6', '#13111C', 4.5],
    ['#A78BFA', '#13111C', 4.5],
    ['#13111C', '#A78BFA', 4.5],
    ['#13111C', '#B9A5FC', 4.5],
    ['#C4B5FD', '#2A2340', 4.5],
    ['#9CA3AF', '#1E1B2E', 4.5],
    ['#F87171', '#1E1B2E', 4.5],
    ['#4ADE80', '#1E1B2E', 4.5],
    ['#FBBF24', '#1E1B2E', 4.5],
    ['#38BDF8', '#1E1B2E', 4.5],
    ['#551AB9', '#FFFFFF', 3],
    ['#A78BFA', '#13111C', 3],
  ];

  it.each(pairs)('%s on %s >= %s', (fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});

describe('token wiring', () => {
  it('exposes radius 0.625rem', () => {
    expect(css).toMatch(/--radius:\s*0\.625rem;/);
  });

  it('maps new palette to tailwind preset', () => {
    expect(preset.theme.extend.colors.primary.hover).toBe('hsl(var(--primary-hover))');
    expect(preset.theme.extend.colors.primary.light).toBe('hsl(var(--primary-light))');
    expect(preset.theme.extend.colors.success.strong).toBe('hsl(var(--success-strong))');
    expect(preset.theme.extend.colors.warning.strong).toBe('hsl(var(--warning-strong))');
    expect(preset.theme.extend.colors.info.strong).toBe('hsl(var(--info-strong))');
    expect(preset.theme.extend.colors.destructive.strong).toBe('hsl(var(--destructive-strong))');
    expect(preset.theme.extend.boxShadow.soft).toBeTruthy();
    expect(preset.theme.extend.boxShadow['soft-lg']).toBeTruthy();
  });
});
