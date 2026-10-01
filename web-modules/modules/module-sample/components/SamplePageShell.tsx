import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@arsi/container';
import { Button, PageHeader } from '@arsi/shared';

export interface SamplePageShellProps {
  titleKey: string;
  descriptionKey: string;
  children: ReactNode;
}

export function SamplePageShell({ titleKey, descriptionKey, children }: SamplePageShellProps) {
  const { t } = useTranslation('module-sample');

  return (
    <div>
      <PageHeader
        title={t(titleKey)}
        description={t(descriptionKey)}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/module-sample">{t('actions.back')}</Link>
          </Button>
        }
      />
      <div className="space-y-4">{children}</div>
    </div>
  );
}
