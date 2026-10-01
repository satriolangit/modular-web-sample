import { useMemo } from 'react';
import { useApiRegistry, useEventBus, useLogger, useQuery } from '@arsi/container';
import { createSampleService } from '@arsi/module-module-sample';

export function useClientASampleUser(id: number) {
  const apiRegistry = useApiRegistry();
  const events = useEventBus();
  const logger = useLogger();

  const service = useMemo(() => {
    const base = createSampleService(apiRegistry.get('module-sample'));

    return {
      ...base,
      async getUser(userId: number) {
        if (userId > 3) {
          throw new Error('client-a: hanya user 1-3 yang boleh diakses');
        }
        const user = await base.getUser(userId);
        logger.info('client-a: wrapped sample service', { userId });
        events.emit('client-a.sample.userFetched', { id: user.id });
        return { ...user, lastName: `${user.lastName} (client-a)` };
      },
    };
  }, [apiRegistry, events, logger]);

  return useQuery({
    queryKey: ['client-a', 'sample', 'user', id],
    queryFn: () => service.getUser(id),
  });
}
