import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

function generatePageNumbers(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) result.push("...");
    result.push(p);
  });
  return result;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeLabel = "Rows per page",
  pageSizeOptions = [10, 25, 50, 100, 200],
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeLabel?: string;
  pageSizeOptions?: number[];
  className?: string;
}) {
  if (total <= 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 text-sm", className)}>
      <div className="flex items-center gap-3 text-ink-muted">
        <span>
          {from}–{to} of {total}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs">{pageSizeLabel}</span>
            <Select
              className="h-8 w-20 pl-2 pr-6 text-xs"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {generatePageNumbers(page, totalPages).map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-ink-faint">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                "h-8 min-w-8 rounded-md px-2 text-sm",
                p === page ? "bg-brand text-brand-contrast" : "text-ink-muted hover:bg-paper-sunken",
              )}
            >
              {p}
            </button>
          ),
        )}
        <Button variant="ghost" size="icon" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
