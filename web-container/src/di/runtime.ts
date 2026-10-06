import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

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

export interface RuntimeHooks {
  useConfig: typeof useConfig;
  useLogger: typeof useLogger;
  useApi: typeof useApi;
  useApiRegistry: typeof useApiRegistry;
  useEventBus: typeof useEventBus;
  useToast: typeof useToast;
  useModal: typeof useModal;
  useNotifications: typeof useNotifications;
  useSlot: typeof useSlot;
  useTheme: typeof useTheme;
  useLocale: typeof useLocale;
  useAuth: typeof useAuth;
  useTranslation: typeof useTranslation;
  useQuery: typeof useQuery;
  useMutation: typeof useMutation;
  useQueryClient: typeof useQueryClient;
  useAuthStore: typeof useAuthStore;
  useThemeStore: typeof useThemeStore;
  useLocaleStore: typeof useLocaleStore;
}

export function createRuntimeHooks(): RuntimeHooks {
  return {
    useConfig,
    useLogger,
    useApi,
    useApiRegistry,
    useEventBus,
    useToast,
    useModal,
    useNotifications,
    useSlot,
    useTheme,
    useLocale,
    useAuth,
    useTranslation,
    useQuery,
    useMutation,
    useQueryClient,
    useAuthStore,
    useThemeStore,
    useLocaleStore,
  };
}
