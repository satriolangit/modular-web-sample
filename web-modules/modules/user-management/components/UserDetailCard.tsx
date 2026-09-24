import { useTranslation } from '@arsi/container';
import { Badge, Card } from '@arsi/shared';

import type { User } from '../types';

export interface UserDetailCardProps {
  user: User;
}

export function UserDetailCard({ user }: UserDetailCardProps) {
  const { t } = useTranslation('user-management');

  const rows = [
    { label: t('fields.firstName'), value: user.firstName },
    { label: t('fields.lastName'), value: user.lastName },
    { label: t('fields.email'), value: user.email },
    { label: t('fields.age'), value: user.age ? String(user.age) : '-' },
    { label: t('fields.role'), value: user.role ?? t('columns.roleUnknown') },
  ];

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{`${user.firstName} ${user.lastName}`}</h2>
        <Badge variant="secondary">{user.role ?? t('columns.roleUnknown')}</Badge>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</dt>
            <dd className="text-sm">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
