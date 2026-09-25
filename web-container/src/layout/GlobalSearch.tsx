import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { containerEvents, type ContainerSearchPayload } from '../events/containerEvents';
import { useEventBus } from '../hooks/useEventBus';

const DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function GlobalSearch() {
  const { t } = useTranslation();
  const events = useEventBus();
  const [value, setValue] = useState('');
  const debouncedValue = useDebouncedValue(value, DEBOUNCE_MS);
  const lastEmitted = useRef<string | null>(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (lastEmitted.current === debouncedValue) {
      return;
    }
    lastEmitted.current = debouncedValue;
    events.emit<ContainerSearchPayload>(containerEvents.searchChanged, { query: debouncedValue });
  }, [debouncedValue, events]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    lastEmitted.current = value;
    events.emit<ContainerSearchPayload>(containerEvents.searchChanged, { query: value });
  };

  return (
    <div className="relative hidden sm:block">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        <SearchIcon />
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('search.placeholder')}
        aria-label={t('search.label')}
        className="h-8 w-40 rounded-md border border-input bg-card pl-8 pr-3 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 md:w-56"
      />
    </div>
  );
}
