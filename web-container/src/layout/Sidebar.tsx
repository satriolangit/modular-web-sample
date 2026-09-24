import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { useDeps } from '../di/DepsContext';

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  const base = 'block rounded-md border-l-2 px-3 py-2 text-sm transition-colors';
  return isActive
    ? `${base} border-primary bg-accent font-medium text-accent-foreground`
    : `${base} border-transparent text-foreground hover:bg-accent/60 hover:text-accent-foreground`;
}

export function Sidebar() {
  const { menu } = useDeps();
  const { t } = useTranslation();
  const items = menu.getAll();

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card px-3 py-4 md:flex md:flex-col">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-light text-sm font-bold text-primary-foreground"
        >
          A
        </span>
        <span className="text-sm font-semibold tracking-tight">{t('app.title')}</span>
      </div>
      <nav className="space-y-1">
        <NavLink to="/" end className={navLinkClassName}>
          {t('nav.home')}
        </NavLink>
        {items.map((item) => (
          <NavLink key={item.path} to={item.path} className={navLinkClassName}>
            {t(item.label, { ns: item.namespace ?? 'common' })}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
