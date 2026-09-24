import { useTranslation } from 'react-i18next';

import { useToast } from '../hooks/useToast';
import { useAuthStore } from '../store/authStore';
import { useLocaleStore } from '../store/localeStore';
import { useThemeStore } from '../store/themeStore';

const buttonClassName =
  'inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground';

export function Topbar() {
  const { t } = useTranslation();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  const handleLogout = () => {
    logout();
    toast.info(t('actions.signOut'));
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-card px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={buttonClassName}
          onClick={toggleTheme}
          aria-label={t('actions.toggleTheme')}
        >
          {t(`theme.${theme}`)}
        </button>
        <div className="flex items-center gap-1 rounded-md border border-input p-0.5">
          {(['en', 'id'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLocale(item)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                locale === item
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {t(`locale.${item}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user?.displayName}</span>
        <button type="button" className={buttonClassName} onClick={handleLogout}>
          {t('actions.signOut')}
        </button>
      </div>
    </header>
  );
}
