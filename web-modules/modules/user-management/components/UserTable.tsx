import { useSlot, useTranslation } from '@arsi/container';
import { Badge, Button, DataTable, type DataTableColumn } from '@arsi/shared';

import { userSlots } from '../slots';
import type { User } from '../types';

export interface UserTableProps {
  users: User[];
  isLoading?: boolean;
  onView?: (user: User) => void;
}

export function UserTable({ users, isLoading, onView }: UserTableProps) {
  const { t } = useTranslation('user-management');
  const RowActions = useSlot<{ user: User }>(userSlots.userTableActions);

  const columns: DataTableColumn<User>[] = [
    {
      key: 'name',
      header: t('columns.name'),
      render: (user) => `${user.firstName} ${user.lastName}`,
    },
    {
      key: 'email',
      header: t('columns.email'),
      render: (user) => user.email,
    },
    {
      key: 'role',
      header: t('columns.role'),
      render: (user) => (
        <Badge variant="secondary">{user.role ?? t('columns.roleUnknown')}</Badge>
      ),
    },
    {
      key: 'actions',
      header: t('columns.actions'),
      className: 'text-right',
      render: (user) => (
        <div className="flex justify-end gap-2">
          {onView ? (
            <Button variant="outline" size="sm" onClick={() => onView(user)}>
              {t('actions.view')}
            </Button>
          ) : null}
          {RowActions ? <RowActions user={user} /> : null}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={users}
      rowKey={(user) => user.id}
      isLoading={isLoading}
      emptyMessage={t('empty')}
    />
  );
}
