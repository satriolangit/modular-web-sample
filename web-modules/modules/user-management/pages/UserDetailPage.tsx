import { Link, useParams } from 'react-router-dom';
import { useSlot, useTranslation } from '@arsi/container';
import { Button, Skeleton } from '@arsi/shared';

import { UserDetailCard } from '../components/UserDetailCard';
import { useUser } from '../hooks/useUser';
import { userSlots } from '../slots';
import type { User } from '../types';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('user-management');
  const { data: user, isLoading, isError } = useUser(id);
  const DetailSidebar = useSlot<{ user: User }>(userSlots.userDetailSidebar);

  return (
    <div>
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/users">{t('actions.back')}</Link>
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}
      {isError ? <p className="text-sm text-destructive">{t('detail.error')}</p> : null}
      {user ? (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <UserDetailCard user={user} />
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('detail.sidebarTitle')}
            </h2>
            {DetailSidebar ? (
              <DetailSidebar user={user} />
            ) : (
              <p className="text-sm text-muted-foreground">{t('detail.sidebarEmpty')}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
