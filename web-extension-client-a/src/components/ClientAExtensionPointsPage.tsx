import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@arsi/container';
import { Badge, Button, Card, Input, Label, PageHeader } from '@arsi/shared';

import { useClientASampleUser } from '../hooks/useClientASample';

export function ClientAExtensionPointsPage() {
  const { t } = useTranslation('client-a');
  const [userId, setUserId] = useState(1);
  const { data, isFetching, isError, error } = useClientASampleUser(userId);

  return (
    <div>
      <PageHeader
        title={t('sample.pageTitle')}
        description={t('sample.pageDescription')}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/module-sample">{t('sample.back')}</Link>
          </Button>
        }
      />

      <Card className="p-4">
        <Badge variant="info">{t('sample.routeBadge')}</Badge>

        <div className="mt-3 max-w-xs space-y-1.5">
          <Label htmlFor="client-a-sample-user">{t('sample.userId')}</Label>
          <Input
            id="client-a-sample-user"
            type="number"
            min={1}
            value={userId}
            onChange={(event) => setUserId(Number(event.target.value) || 1)}
          />
        </div>

        <div className="mt-4 text-sm">
          {isFetching ? <p className="text-muted-foreground">…</p> : null}
          {isError ? (
            <p className="text-destructive">
              {error instanceof Error ? error.message : t('sample.error')}
            </p>
          ) : null}
          {data ? (
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{t('sample.wrappedNote')}</p>
      </Card>
    </div>
  );
}
