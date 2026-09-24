import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';

import type { Deps } from '../di/deps';
import { DepsProvider } from '../di/DepsContext';
import { useLocaleStore } from '../store/localeStore';
import { useThemeStore } from '../store/themeStore';
import { applyTheme } from '../theme/applyTheme';

function AppEffects() {
  const theme = useThemeStore((state) => state.theme);
  const locale = useLocaleStore((state) => state.locale);
  const { i18n } = useTranslation();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    void i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
  }, [i18n, locale]);

  useEffect(() => {
    document.title = i18n.t('app.title');
  }, [i18n, locale]);

  return null;
}

export function AppProviders({ deps, children }: { deps: Deps; children: ReactNode }) {
  return (
    <DepsProvider deps={deps}>
      <QueryClientProvider client={deps.queryClient}>
        <I18nextProvider i18n={deps.i18n}>
          <AppEffects />
          <Toaster position="top-right" richColors closeButton />
          {children}
        </I18nextProvider>
      </QueryClientProvider>
    </DepsProvider>
  );
}
