import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, ErrorState, Skeleton } from '@arsi/shared';
import { useConfig, useToast, useTranslation, type ToastService } from '@arsi/container';

import { ModuleTable } from '../components/ModuleTable';
import { TokenBar } from '../components/TokenBar';
import { UploadCard } from '../components/UploadCard';
import { REGISTRY_ADMIN_TOKEN_KEY } from '../constants';
import { useRegistryAdmin } from '../hooks/useRegistryAdmin';
import { resolveActionError } from '../services/service.registryAdmin';

export function ModuleRegistryPage() {
  const { t } = useTranslation('registry-admin');
  const config = useConfig();
  const toast = useToast();
  const [token, setToken] = useState(
    () => localStorage.getItem(REGISTRY_ADMIN_TOKEN_KEY) ?? '',
  );

  if (!config.registryAdminUrl) {
    return <ErrorState title={t('title')} description={t('errors.notConfigured')} />;
  }

  return <ModuleRegistryContent token={token} setToken={setToken} toast={toast} />;
}

function ModuleRegistryContent({
  token,
  setToken,
  toast,
}: {
  token: string;
  setToken: (token: string) => void;
  toast: ToastService;
}) {
  const { t } = useTranslation('registry-admin');
  const { modulesQuery, uploadMutation, toggleMutation, deleteMutation } = useRegistryAdmin();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('description')}</p>
          <TokenBar
            token={token}
            onSave={(value: string) => {
              localStorage.setItem(REGISTRY_ADMIN_TOKEN_KEY, value);
              setToken(value);
              toast.success(t('token.saved'));
              void modulesQuery.refetch();
            }}
          />
        </CardContent>
      </Card>

      <UploadCard
        busy={uploadMutation.isPending}
        onUpload={async (file: File) => {
          try {
            const result = await uploadMutation.mutateAsync(file);
            toast.success(
              t('upload.success', { name: result.module.name, version: result.module.version }),
            );
          } catch (error) {
            toast.error(t('upload.error', { message: (error as Error).message }));
          }
        }}
      />

      {modulesQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : modulesQuery.isError ? (
        <ErrorState
          title={t('title')}
          description={t('errors.load', { message: (modulesQuery.error as Error).message })}
        />
      ) : (
        <ModuleTable
          modules={modulesQuery.data ?? []}
          busy={toggleMutation.isPending || deleteMutation.isPending}
          onToggle={(name, enabled) =>
            toggleMutation.mutate(
              { name, enabled },
              {
                onError: (error) =>
                  toast.error(t('errors.action', { message: resolveActionError(error) })),
              },
            )
          }
          onDelete={(name) =>
            deleteMutation.mutate(name, {
              onError: (error) =>
                toast.error(t('errors.action', { message: resolveActionError(error) })),
            })
          }
        />
      )}
    </div>
  );
}
