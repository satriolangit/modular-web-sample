import { useTranslation } from 'react-i18next';

import { useToast } from '../hooks/useToast';
import { useAuthStore } from '../store/authStore';
import { useLocaleStore } from '../store/localeStore';
import { useThemeStore } from '../store/themeStore';
import { getInitials } from './getInitials';

const focusRingClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const iconButtonClassName = `inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-card shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground ${focusRingClassName}`;

const ghostButtonClassName = `inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${focusRingClassName}`;

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

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
          className={iconButtonClassName}
          onClick={toggleTheme}
          aria-label={t('actions.toggleTheme')}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <div className="flex items-center gap-1 rounded-lg border border-input bg-muted/50 p-0.5">
          {(['en', 'id'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLocale(item)}
              aria-pressed={locale === item}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                locale === item
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`locale.${item}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
        >
          {getInitials(user?.displayName)}
        </span>
        <span className="text-sm font-medium">{user?.displayName}</span>
        <button type="button" className={ghostButtonClassName} onClick={handleLogout}>
          {t('actions.signOut')}
        </button>
      </div>
    </header>
  );
}
