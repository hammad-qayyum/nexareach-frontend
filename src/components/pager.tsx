import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeftIcon data-icon="inline-start" /> Previous
        </Button>
        <Button variant="outline" size="sm" disabled={last >= total} onClick={() => onPage(page + 1)}>
          Next <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
