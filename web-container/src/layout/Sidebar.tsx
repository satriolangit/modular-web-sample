import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { useDeps } from '../di/DepsContext';

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return `block rounded-md px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
  }`;
}

export function Sidebar() {
  const { menu } = useDeps();
  const { t } = useTranslation();
  const items = menu.getAll();

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card px-3 py-4 md:block">
      <div className="mb-6 px-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t('app.title')}
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
