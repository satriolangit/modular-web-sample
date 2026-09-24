import { Link, useParams } from 'react-router-dom';
import { useTranslation } from '@arsi/container';
import { Badge, Button, PageHeader, Skeleton } from '@arsi/shared';
import { UserDetailCard, useUser } from '@arsi/module-user-management';

export function ClientAUserDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('user-management');
  const { t: tClient } = useTranslation('client-a');
  const { data: user, isLoading, isError } = useUser(id);

  return (
    <div>
      <PageHeader
        title={tClient('detail.title')}
        description={tClient('detail.description')}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/users">{t('actions.back')}</Link>
          </Button>
        }
      />
      <div className="mb-4">
        <Badge>{tClient('badge')}</Badge>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {isError ? <p className="text-sm text-destructive">{t('detail.error')}</p> : null}
      {user ? <UserDetailCard user={user} /> : null}
    </div>
  );
}
