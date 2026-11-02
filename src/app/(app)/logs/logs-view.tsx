"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, unwrap } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { isAdmin, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { actionOptions, exportUrl, PAGE_SIZE, readFilters, toApiQuery, writeFilters, type UrlFilters } from "./filters";
import { LogDetails } from "./log-details";

const ALL = "__all__";

export function LogsView() {
  const me = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const filters = readFilters(useSearchParams());
  const [expanded, setExpanded] = useState<number | null>(null);

  const query = toApiQuery(filters);
  const logs = useQuery({
    queryKey: ["logs", query, filters.page],
    queryFn: () =>
      unwrap(
        api.GET("/api/logs", {
          params: { query: { ...query, limit: PAGE_SIZE, offset: (filters.page - 1) * PAGE_SIZE } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
  const actions = useQuery({ queryKey: ["logs", "actions"], queryFn: () => unwrap(api.GET("/api/logs/actions")) });
  // Only admins can list users, so only they get the "who" filter.
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => unwrap(api.GET("/api/users")),
    enabled: isAdmin(me.role),
  });

  function update(changes: Partial<UrlFilters>) {
    setExpanded(null);
    router.replace(`${pathname}${writeFilters({ ...filters, page: 1, ...changes })}`, { scroll: false });
  }

  const hasFilters = Boolean(
    filters.action || filters.actor || filters.entityType || filters.entityId || filters.from || filters.to,
  );
  const total = logs.data?.total ?? 0;
  const firstRow = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(filters.page * PAGE_SIZE, total);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Activity log"
        description="Every change, who made it and what it changed. Entries can't be edited or deleted."
        actions={
          <Button variant="outline" asChild>
            {/* A plain download link: the browser sends the session cookie, and exports are logged. */}
            <a href={exportUrl(filters)} download>
              <DownloadIcon data-icon="inline-start" /> Export CSV
            </a>
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Action" id="filter-action">
          <Select value={filters.action || ALL} onValueChange={(v) => update({ action: v === ALL ? "" : v })}>
            <SelectTrigger id="filter-action" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All actions</SelectItem>
              <SelectSeparator />
              {actionOptions(actions.data ?? []).map((o) => (
                <SelectItem key={o.value} value={o.value} className={cn(!o.value.endsWith(".") && "font-mono text-xs")}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        {isAdmin(me.role) && (
          <FilterField label="User" id="filter-actor">
            <Select value={filters.actor || ALL} onValueChange={(v) => update({ actor: v === ALL ? "" : v })}>
              <SelectTrigger id="filter-actor" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Anyone</SelectItem>
                <SelectSeparator />
                {users.data?.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        )}

        <FilterField label="From" id="filter-from">
          <Input
            id="filter-from"
            type="date"
            className="w-40"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => update({ from: e.target.value })}
          />
        </FilterField>
        <FilterField label="To" id="filter-to">
          <Input
            id="filter-to"
            type="date"
            className="w-40"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => update({ to: e.target.value })}
          />
        </FilterField>

        {(filters.entityType || filters.entityId) && (
          <Badge variant="secondary" className="h-8 gap-1 pr-1 font-normal">
            {filters.entityType || "item"}
            {filters.entityId && <span className="font-mono">#{filters.entityId}</span>}
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Clear item filter"
              onClick={() => update({ entityType: "", entityId: "" })}
            >
              <XIcon />
            </Button>
          </Badge>
        )}

        {hasFilters && (
          <Button variant="ghost" onClick={() => update({ action: "", actor: "", entityType: "", entityId: "", from: "", to: "" })}>
            Clear filters
          </Button>
        )}
      </div>

      {logs.error ? (
        <QueryError error={logs.error} onRetry={() => logs.refetch()} />
      ) : (
        <div className="grid gap-3">
          <div className={cn("overflow-hidden rounded-lg border transition-opacity", logs.isPlaceholderData && "opacity-60")}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-44 pl-4">Time</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="pr-4">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.isPending ? (
                  Array.from({ length: 8 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="px-4">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : logs.data.items.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      {hasFilters ? "No activity matches these filters." : "No activity yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.data.items.map((log) => {
                    const open = expanded === log.id;
                    return (
                      <Fragment key={log.id}>
                        <TableRow
                          className="cursor-pointer"
                          data-state={open ? "selected" : undefined}
                          aria-expanded={open}
                          tabIndex={0}
                          onClick={() => setExpanded(open ? null : log.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpanded(open ? null : log.id);
                            }
                          }}
                        >
                          <TableCell className="pl-4 text-muted-foreground tabular-nums">
                            {formatDateTime(log.created_at)}
                          </TableCell>
                          <TableCell className="max-w-56 truncate">{log.actor_label}</TableCell>
                          <TableCell>
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{log.action}</code>
                          </TableCell>
                          <TableCell>
                            {log.entity_type ? (
                              <button
                                type="button"
                                className="text-sm underline-offset-4 hover:underline"
                                title="Show only this item's history"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  update({ entityType: log.entity_type ?? "", entityId: log.entity_id ?? "" });
                                }}
                              >
                                {log.entity_type}
                                {log.entity_id && <span className="font-mono text-muted-foreground"> #{log.entity_id}</span>}
                              </button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="pr-4 font-mono text-xs text-muted-foreground">{log.ip ?? "—"}</TableCell>
                        </TableRow>
                        {open && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={5} className="px-4 py-4 whitespace-normal">
                              <LogDetails log={log} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {total > 0 && (
            <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
              <span className="tabular-nums">
                {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of {total.toLocaleString()}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page <= 1}
                  onClick={() => update({ page: filters.page - 1 })}
                >
                  <ChevronLeftIcon data-icon="inline-start" /> Newer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={lastRow >= total}
                  onClick={() => update({ page: filters.page + 1 })}
                >
                  Older <ChevronRightIcon data-icon="inline-end" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
