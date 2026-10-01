import { useEffect, useState } from 'react';
import {
  containerEvents,
  useEventBus,
  useTranslation,
  type ContainerSearchPayload,
} from '@arsi/container';
import { Button, Card } from '@arsi/shared';

import { SamplePageShell } from '../components/SamplePageShell';
import { sampleEvents, type SamplePostCreatedPayload } from '../events';

export function SampleEventsPage() {
  const { t } = useTranslation('module-sample');
  const events = useEventBus();
  const [lastEvent, setLastEvent] = useState<SamplePostCreatedPayload | null>(null);
  const [lastSearch, setLastSearch] = useState<string | null>(null);

  useEffect(() => {
    const offModuleEvent = events.on<SamplePostCreatedPayload>(
      sampleEvents.postCreated,
      (payload) => {
        setLastEvent(payload);
      },
    );
    const offContainerEvent = events.on<ContainerSearchPayload>(
      containerEvents.searchChanged,
      ({ query }) => {
        setLastSearch(query);
      },
    );

    return () => {
      offModuleEvent();
      offContainerEvent();
    };
  }, [events]);

  return (
    <SamplePageShell titleKey="events.title" descriptionKey="events.description">
      <Card className="p-4">
        <Button
          onClick={() =>
            events.emit(sampleEvents.postCreated, {
              id: Date.now(),
              title: `sample-${Date.now()}`,
            })
          }
        >
          {t('events.emit')}
        </Button>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('events.emitted')}
            </p>
            <p className="mt-0.5">
              {lastEvent ? `${lastEvent.id} — ${lastEvent.title}` : t('events.none')}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('events.containerSearch')}
            </p>
            <p className="mt-0.5">{lastSearch ?? t('events.none')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('events.containerSearchHint')}
            </p>
          </div>
        </div>
      </Card>
    </SamplePageShell>
  );
}
