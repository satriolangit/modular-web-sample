import { useState } from 'react';

import { useRuntime } from '../runtime';

export function RuntimeDemoPage() {
  const { useApi, useConfig, useQuery, useToast, useTranslation } = useRuntime();
  const { t } = useTranslation('runtime-demo');
  const config = useConfig();
  const api = useApi();
  const toast = useToast();
  const [count, setCount] = useState(0);
  const { data, isLoading } = useQuery({
    queryKey: ['runtime-demo', 'user', 1],
    queryFn: async () => (await api.get('/users/1')).data as { firstName: string },
  });

  return (
    <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-soft">
      <h1 className="text-xl font-semibold text-primary">{t('title')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
      <p className="mt-4 text-sm" data-testid="runtime-demo-client">
        client: {config.client}
      </p>
      <p className="mt-1 text-sm" data-testid="runtime-demo-user">
        {isLoading ? t('loading') : data?.firstName}
      </p>
      <button
        type="button"
        className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        onClick={() => {
          setCount((value) => value + 1);
          toast.success(t('toast', { count: count + 1 }));
        }}
      >
        {t('button', { count })}
      </button>
    </section>
  );
}
