import { useMemo } from 'react';
import { useApiRegistry, useMutation, useQuery, useQueryClient } from '@arsi/container';

import { createRegistryAdminService } from '../services/service.registryAdmin';

export const registryAdminKeys = {
  all: ['registry-admin', 'modules'] as const,
};

export function useRegistryAdmin() {
  const apiRegistry = useApiRegistry();
  const queryClient = useQueryClient();
  const service = useMemo(
    () => createRegistryAdminService(apiRegistry.get('registry-admin')),
    [apiRegistry],
  );

  const modulesQuery = useQuery({
    queryKey: registryAdminKeys.all,
    queryFn: () => service.list(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: registryAdminKeys.all });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => service.upload(file),
    onSuccess: invalidate,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      service.setEnabled(name, enabled),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => service.remove(name),
    onSuccess: invalidate,
  });

  return { modulesQuery, uploadMutation, toggleMutation, deleteMutation };
}
