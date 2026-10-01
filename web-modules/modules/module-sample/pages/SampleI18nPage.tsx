import { useLocale, useTranslation } from '@arsi/container';
import { Button, Card } from '@arsi/shared';

import { SamplePageShell } from '../components/SamplePageShell';

export function SampleI18nPage() {
  const { t } = useTranslation('module-sample');
  const { locale, setLocale } = useLocale();

  return (
    <SamplePageShell titleKey="i18n.title" descriptionKey="i18n.description">
      <Card className="p-4">
        <p className="text-lg font-medium">{t('i18n.greeting', { name: 'ARSI' })}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('i18n.current', { locale })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['en', 'id'] as const)
            .filter((item) => item !== locale)
            .map((item) => (
              <Button key={item} variant="outline" onClick={() => setLocale(item)}>
                {t('i18n.switch', { locale: item })}
              </Button>
            ))}
        </div>
      </Card>
    </SamplePageShell>
  );
}
