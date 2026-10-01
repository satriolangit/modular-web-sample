import { Link } from 'react-router-dom';
import { useTranslation } from '@arsi/container';
import { Card, CardDescription, CardTitle } from '@arsi/shared';

import { samplePages } from '../pages/samplePages';

export function SampleNav() {
  const { t } = useTranslation('module-sample');

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {samplePages.map((page) => (
        <Link
          key={page.path}
          to={page.path}
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Card className="h-full p-4 transition-colors hover:bg-accent/50">
            <CardTitle className="text-sm">{t(page.labelKey)}</CardTitle>
            <CardDescription className="mt-1">{t(page.descriptionKey)}</CardDescription>
          </Card>
        </Link>
      ))}
    </div>
  );
}
