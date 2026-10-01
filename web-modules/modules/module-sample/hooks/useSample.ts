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

import { sampleEvents } from '../events';
import { sampleKeys } from '../queryKeys';
import { createSampleService, type SamplePostListParams } from '../services/service.sample';
import type { CreateSamplePostInput } from '../types';

function useSampleService() {
  const apiRegistry = useApiRegistry();
  return useMemo(() => createSampleService(apiRegistry.get('module-sample')), [apiRegistry]);
}

export function useSampleUser(id: number) {
  const service = useSampleService();

  return useQuery({
    queryKey: sampleKeys.user(id),
    queryFn: () => service.getUser(id),
  });
}

export function useSamplePosts(params?: SamplePostListParams) {
  const service = useSampleService();

  return useQuery({
    queryKey: sampleKeys.postList(params),
    queryFn: () => service.listPosts(params),
  });
}

export function useCreateSamplePost() {
  const service = useSampleService();
  const queryClient = useQueryClient();
  const events = useEventBus();
  const toast = useToast();
  const { t } = useTranslation('module-sample');

  return useMutation({
    mutationFn: (input: CreateSamplePostInput) => service.createPost(input),
    onSuccess: (post) => {
      void queryClient.invalidateQueries({ queryKey: sampleKeys.posts() });
      events.emit(sampleEvents.postCreated, { id: post.id, title: post.title });
      toast.success(t('query.createSuccess'));
    },
    onError: () => toast.error(t('query.createError')),
  });
}
