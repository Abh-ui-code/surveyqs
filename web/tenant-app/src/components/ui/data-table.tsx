import { AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationBar, type PaginationState } from "@/components/ui/pagination-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  key: string;
  label: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyIcon?: React.ComponentProps<typeof EmptyState>["icon"];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  skeletonRows?: number;
  tableClassName?: string;
}

/**
 * A four-state table: loading shows skeleton rows at the real geometry so
 * nothing shifts when data lands; a background refetch shows a thin
 * indeterminate strip while keeping the current rows visible (never blanks
 * the table); an error state is visually distinct from empty, so a 500
 * never reads as "no records"; and a genuinely empty result gets a real
 * empty state with an action, not a bare "no data" string.
 */
export function DataTable<T extends { id: string }>({
  columns,
  data,
  isLoading,
  isFetching,
  isError,
  errorMessage = "Something went wrong loading this data.",
  emptyIcon,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  onRowClick,
  pagination,
  onPageChange,
  onPageSizeChange,
  skeletonRows,
  tableClassName,
}: DataTableProps<T>) {
  const rowCount = skeletonRows ?? pagination?.pageSize ?? 6;

  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-paper-raised">
      {isFetching && !isLoading && (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-brand-soft">
          <div className="h-full w-1/3 bg-brand animate-indeterminate-bar" />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className={cn("w-full text-left text-sm", tableClassName)}>
          <thead>
            <tr className="border-b border-line bg-paper-sunken/60">
              {columns.map((col) => (
                <th key={col.key} className={cn("px-4 py-2.5 text-xs font-medium text-ink-muted", col.className)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: rowCount }).map((_, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-[80%]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rust-soft text-rust">
                      <AlertCircle className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-medium text-ink">{errorMessage}</p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-line last:border-0",
                    onRowClick && "cursor-pointer hover:bg-paper-sunken/60",
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3 align-middle", col.className)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && onPageChange && !isLoading && !isError && data.length > 0 && (
        <PaginationBar
          className="border-t border-line px-4 py-3"
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
