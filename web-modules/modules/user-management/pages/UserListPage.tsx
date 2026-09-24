import { useNavigate } from 'react-router-dom';
import { useModal, useTranslation } from '@arsi/container';
import { Button, Input, PageHeader } from '@arsi/shared';

import { UserTable } from '../components/UserTable';
import { useUserList } from '../hooks/useUser';
import { userModals } from '../modals';
import { useUserStore } from '../store/useUserStore';
import type { User } from '../types';

export function UserListPage() {
  const { t } = useTranslation('user-management');
  const navigate = useNavigate();
  const modal = useModal();
  const search = useUserStore((state) => state.search);
  const page = useUserStore((state) => state.page);
  const pageSize = useUserStore((state) => state.pageSize);
  const setSearch = useUserStore((state) => state.setSearch);
  const setPage = useUserStore((state) => state.setPage);

  const { data, isLoading, isError } = useUserList({
    limit: pageSize,
    skip: (page - 1) * pageSize,
    search: search || undefined,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleView = (user: User) => {
    navigate(`/users/${user.id}`);
  };

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('list.description')}
        actions={<Button onClick={() => modal.open(userModals.create)}>{t('actions.create')}</Button>}
      />
      <div className="mb-4 max-w-sm">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('search.placeholder')}
        />
      </div>
      {isError ? (
        <p className="text-sm text-destructive">{t('list.error')}</p>
      ) : (
        <UserTable users={data?.users ?? []} isLoading={isLoading} onView={handleView} />
      )}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{t('pagination.summary', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {t('pagination.previous')}
          </Button>
          <span>{t('pagination.page', { page, totalPages })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            {t('pagination.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
