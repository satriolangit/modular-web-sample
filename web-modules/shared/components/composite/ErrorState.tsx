import { Button } from '../ui/button';

export interface ErrorStateProps {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, description, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-8 text-center">
      <h3 className="text-base font-medium text-destructive">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {onRetry && retryLabel ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
