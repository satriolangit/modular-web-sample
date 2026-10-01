import { useState } from 'react';
import { useLogger, useTranslation } from '@arsi/container';
import { Button, Card } from '@arsi/shared';

import { SamplePageShell } from '../components/SamplePageShell';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function SampleLoggerPage() {
  const { t } = useTranslation('module-sample');
  const logger = useLogger();
  const [lastLog, setLastLog] = useState<{ level: LogLevel; message: string } | null>(null);

  const log = (level: LogLevel) => {
    const message = t(`logger.${level}`);
    logger[level](`module-sample: ${message}`, { source: 'module-sample' });
    setLastLog({ level, message });
  };

  return (
    <SamplePageShell titleKey="logger.title" descriptionKey="logger.description">
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {(['debug', 'info', 'warn', 'error'] as const).map((level) => (
            <Button key={level} variant="outline" onClick={() => log(level)}>
              {t(`logger.${level}`)}
            </Button>
          ))}
        </div>
        {lastLog ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('logger.logged', { level: lastLog.level, message: lastLog.message })}
          </p>
        ) : null}
      </Card>
    </SamplePageShell>
  );
}
