import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
  busy = false,
}: {
  modules: RegistryModuleSummary[];
  onToggle: (name: string, enabled: boolean) => void;
  onDelete: (name: string) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation('registry-admin');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  if (modules.length === 0) {
    return <EmptyState title={t('title')} description={t('table.empty')} />;
  }

  return (
    <>
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
                  disabled={busy}
                  onClick={() => onToggle(module.name, !module.enabled)}
                >
                  {t(module.enabled ? 'actions.disable' : 'actions.enable')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => setPendingDelete(module.name)}
                >
                  {t('actions.delete')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('actions.deleteConfirm', { name: pendingDelete })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive-strong"
              onClick={() => {
                if (pendingDelete) {
                  onDelete(pendingDelete);
                }
                setPendingDelete(null);
              }}
            >
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
