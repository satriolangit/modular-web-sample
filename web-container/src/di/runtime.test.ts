import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { describe, expect, it } from 'vitest';

import { useAuth } from '../auth/useAuth';
import { useApi } from '../hooks/useApi';
import { useApiRegistry } from '../hooks/useApiRegistry';
import { useConfig } from '../hooks/useConfig';
import { useEventBus } from '../hooks/useEventBus';
import { useLocale } from '../hooks/useLocale';
import { useLogger } from '../hooks/useLogger';
import { useModal } from '../hooks/useModal';
import { useNotifications } from '../hooks/useNotifications';
import { useSlot } from '../hooks/useSlot';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { useAuthStore } from '../store/authStore';
import { useLocaleStore } from '../store/localeStore';
import { useThemeStore } from '../store/themeStore';
import { createRuntimeHooks } from './runtime';

const expectedKeys = [
  'useConfig',
  'useLogger',
  'useApi',
  'useApiRegistry',
  'useEventBus',
  'useToast',
  'useModal',
  'useNotifications',
  'useSlot',
  'useTheme',
  'useLocale',
  'useAuth',
  'useTranslation',
  'useQuery',
  'useMutation',
  'useQueryClient',
  'useAuthStore',
  'useThemeStore',
  'useLocaleStore',
] as const;

describe('createRuntimeHooks', () => {
  it('menyediakan semua hook yang dikontrakkan', () => {
    const hooks = createRuntimeHooks();
    expect(Object.keys(hooks).sort()).toEqual([...expectedKeys].sort());
  });

  it('memakai referensi fungsi yang sama dengan hook container', () => {
    const hooks = createRuntimeHooks();
    expect(hooks.useApi).toBe(useApi);
    expect(hooks.useApiRegistry).toBe(useApiRegistry);
    expect(hooks.useConfig).toBe(useConfig);
    expect(hooks.useLogger).toBe(useLogger);
    expect(hooks.useEventBus).toBe(useEventBus);
    expect(hooks.useToast).toBe(useToast);
    expect(hooks.useModal).toBe(useModal);
    expect(hooks.useNotifications).toBe(useNotifications);
    expect(hooks.useSlot).toBe(useSlot);
    expect(hooks.useTheme).toBe(useTheme);
    expect(hooks.useLocale).toBe(useLocale);
    expect(hooks.useAuth).toBe(useAuth);
    expect(hooks.useTranslation).toBe(useTranslation);
    expect(hooks.useQuery).toBe(useQuery);
    expect(hooks.useMutation).toBe(useMutation);
    expect(hooks.useQueryClient).toBe(useQueryClient);
    expect(hooks.useAuthStore).toBe(useAuthStore);
    expect(hooks.useThemeStore).toBe(useThemeStore);
    expect(hooks.useLocaleStore).toBe(useLocaleStore);
  });
});
