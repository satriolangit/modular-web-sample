import { useState } from 'react';
import { useApi, useQuery, useTranslation } from '@arsi/container';
import { Button, Card } from '@arsi/shared';

import { SamplePageShell } from '../components/SamplePageShell';
import type { SampleUser } from '../types';

export function SampleApiPage() {
  const { t } = useTranslation('module-sample');
  const api = useApi();
  const [userId, setUserId] = useState(1);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['module-sample', 'deps-api', 'user', userId],
    queryFn: async () => {
      const res = await api.get<SampleUser>(`/users/${userId}`);
      return res.data;
    },
  });

  return (
    <SamplePageShell titleKey="api.title" descriptionKey="api.description">
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((id) => (
            <Button
              key={id}
              variant={id === userId ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUserId(id)}
            >
              {t('api.loadUser', { id })}
            </Button>
          ))}
        </div>

        <div className="mt-4">
          {isFetching ? <p className="text-sm text-muted-foreground">…</p> : null}
          {isError ? <p className="text-sm text-destructive">{t('api.result')}: error</p> : null}
          {data ? (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                {t('api.result')}
              </p>
              <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{t('api.hint')}</p>
      </Card>
    </SamplePageShell>
  );
}
