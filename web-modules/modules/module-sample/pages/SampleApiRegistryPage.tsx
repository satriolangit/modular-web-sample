import { useState } from 'react';
import { useTranslation } from '@arsi/container';
import { Card, Input, Label } from '@arsi/shared';

import { SamplePageShell } from '../components/SamplePageShell';
import { useSampleUser } from '../hooks/useSample';

export function SampleApiRegistryPage() {
  const { t } = useTranslation('module-sample');
  const [userId, setUserId] = useState(1);
  const { data, isFetching, isError } = useSampleUser(userId);

  return (
    <SamplePageShell titleKey="apiRegistry.title" descriptionKey="apiRegistry.description">
      <Card className="p-4">
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="sample-user-id">{t('apiRegistry.userId')}</Label>
          <Input
            id="sample-user-id"
            type="number"
            min={1}
            value={userId}
            onChange={(event) => setUserId(Number(event.target.value) || 1)}
          />
        </div>

        <div className="mt-4">
          {isFetching ? <p className="text-sm text-muted-foreground">…</p> : null}
          {isError ? <p className="text-sm text-destructive">{t('apiRegistry.result')}: error</p> : null}
          {data ? (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                {t('apiRegistry.result')}
              </p>
              <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{t('apiRegistry.hint')}</p>
      </Card>
    </SamplePageShell>
  );
}
