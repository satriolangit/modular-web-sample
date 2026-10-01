import { useTranslation } from '@arsi/container';
import { Button, Card, Input, Label } from '@arsi/shared';

import { SamplePageShell } from '../components/SamplePageShell';
import { useSampleStore } from '../store/useSampleStore';

export function SampleStorePage() {
  const { t } = useTranslation('module-sample');
  const counter = useSampleStore((state) => state.counter);
  const note = useSampleStore((state) => state.note);
  const showDetails = useSampleStore((state) => state.showDetails);
  const increment = useSampleStore((state) => state.increment);
  const decrement = useSampleStore((state) => state.decrement);
  const reset = useSampleStore((state) => state.reset);
  const setNote = useSampleStore((state) => state.setNote);
  const toggleDetails = useSampleStore((state) => state.toggleDetails);

  return (
    <SamplePageShell titleKey="store.title" descriptionKey="store.description">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t('store.counter')}</span>
          <Button variant="outline" size="sm" onClick={decrement}>
            -
          </Button>
          <span className="w-8 text-center text-lg font-semibold">{counter}</span>
          <Button variant="outline" size="sm" onClick={increment}>
            +
          </Button>
        </div>

        <div className="mt-4 max-w-sm space-y-1.5">
          <Label htmlFor="sample-note">{t('store.note')}</Label>
          <Input
            id="sample-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('store.notePlaceholder')}
          />
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm" htmlFor="sample-show-details">
          <input
            id="sample-show-details"
            type="checkbox"
            checked={showDetails}
            onChange={toggleDetails}
            className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
          />
          {t('store.showDetails')}
        </label>

        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={reset}>
            {t('actions.reset')}
          </Button>
        </div>

        {showDetails ? (
          <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify({ counter, note, showDetails }, null, 2)}
          </pre>
        ) : null}

        <p className="mt-3 text-xs text-muted-foreground">{t('store.hint')}</p>
      </Card>
    </SamplePageShell>
  );
}
