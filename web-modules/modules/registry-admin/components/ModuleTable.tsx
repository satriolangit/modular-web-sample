import {
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@arsi/shared';
import { useTranslation } from '@arsi/container';

import type { RegistryModuleSummary } from '../types';
import { ModuleStatusBadge } from './ModuleStatusBadge';

export function ModuleTable({
  modules,
  onToggle,
  onDelete,
}: {
  modules: RegistryModuleSummary[];
  onToggle: (name: string, enabled: boolean) => void;
  onDelete: (name: string) => void;
}) {
  const { t } = useTranslation('registry-admin');

  if (modules.length === 0) {
    return <EmptyState title={t('title')} description={t('table.empty')} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('table.name')}</TableHead>
          <TableHead>{t('table.version')}</TableHead>
          <TableHead>{t('table.apiVersion')}</TableHead>
          <TableHead>{t('table.status')}</TableHead>
          <TableHead>{t('table.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {modules.map((module) => (
          <TableRow key={module.name}>
            <TableCell className="font-medium">{module.name}</TableCell>
            <TableCell>{module.version}</TableCell>
            <TableCell>{module.apiVersion}</TableCell>
            <TableCell>
              <ModuleStatusBadge enabled={module.enabled} />
            </TableCell>
            <TableCell className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggle(module.name, !module.enabled)}
              >
                {t(module.enabled ? 'actions.disable' : 'actions.enable')}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => onDelete(module.name)}>
                {t('actions.delete')}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
