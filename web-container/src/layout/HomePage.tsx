import { useTranslation } from 'react-i18next';

import { useConfig } from '../hooks/useConfig';

export function HomePage() {
  const { t } = useTranslation();
  const config = useConfig();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('home.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('home.description')}</p>
      </div>
      <dl className="grid max-w-md gap-3 rounded-lg border bg-card p-4 text-sm shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{t('app.client')}</dt>
          <dd className="font-medium">{config.client}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{t('app.modules')}</dt>
          <dd className="font-medium">{config.modules.join(', ') || '-'}</dd>
        </div>
      </dl>
    </div>
  );
}
