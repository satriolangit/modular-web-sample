import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

export function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t('routeError.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('routeError.description')}</p>
      <pre className="max-w-xl overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
        {detail}
      </pre>
      <button
        type="button"
        className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        onClick={() => window.location.reload()}
      >
        {t('actions.reload')}
      </button>
    </div>
  );
}
