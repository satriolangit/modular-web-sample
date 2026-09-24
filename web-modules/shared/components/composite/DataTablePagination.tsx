import { Button } from '../ui/button';

export interface DataTablePaginationProps {
  page: number;
  totalPages: number;
  summary: string;
  pageLabel: string;
  previousLabel: string;
  nextLabel: string;
  onPageChange: (page: number) => void;
}

export function DataTablePagination({
  page,
  totalPages,
  summary,
  pageLabel,
  previousLabel,
  nextLabel,
  onPageChange,
}: DataTablePaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{summary}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {previousLabel}
        </Button>
        <span>{pageLabel}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
