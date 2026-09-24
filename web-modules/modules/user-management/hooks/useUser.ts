import { useMemo } from 'react';
import {
  useApiRegistry,
  useEventBus,
  useMutation,
  useQuery,
  useQueryClient,
  useToast,
  useTranslation,
} from '@arsi/container';

import { userEvents } from '../events';
import { userKeys } from '../queryKeys';
import { createUserService, type UserListParams } from '../services/service.user';
import type { CreateUserInput, UpdateUserInput } from '../types';

function useUserService() {
  const apiRegistry = useApiRegistry();
  return useMemo(() => createUserService(apiRegistry.get('user')), [apiRegistry]);
}

export function useUserList(params?: UserListParams) {
  const service = useUserService();

  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => service.list(params),
  });
}

export function useUser(id: string | number | undefined) {
  const service = useUserService();

  return useQuery({
    queryKey: userKeys.detail(id ?? ''),
    queryFn: () => service.getById(id as string | number),
    enabled: Boolean(id),
  });
}

export function useCreateUser() {
  const service = useUserService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const events = useEventBus();
  const { t } = useTranslation('user-management');

  return useMutation({
    mutationFn: (input: CreateUserInput) => service.create(input),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success(t('create.success'));
      events.emit(userEvents.created, { user });
    },
    onError: () => {
      toast.error(t('create.error'));
    },
  });
}

export function useUpdateUser() {
  const service = useUserService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const events = useEventBus();
  const { t } = useTranslation('user-management');

  return useMutation({
    mutationFn: (input: { id: number; changes: UpdateUserInput }) =>
      service.update(input.id, input.changes),
    onSuccess: (user, input) => {
      void queryClient.invalidateQueries({ queryKey: userKeys.detail(input.id) });
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success(t('update.success'));
      events.emit(userEvents.updated, { id: user.id, changes: input.changes });
    },
    onError: () => {
      toast.error(t('update.error'));
    },
  });
}

export function useDeleteUser() {
  const service = useUserService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const events = useEventBus();
  const { t } = useTranslation('user-management');

  return useMutation({
    mutationFn: (id: number) => service.remove(id),
    onSuccess: (_user, id) => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success(t('delete.success'));
      events.emit(userEvents.deleted, { id });
    },
    onError: () => {
      toast.error(t('delete.error'));
    },
  });
}
