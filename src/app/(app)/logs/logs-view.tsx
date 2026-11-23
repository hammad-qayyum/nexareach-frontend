"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, type ReactNode, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { MultiSelect } from "@/components/multi-select";
import { SearchableSelect } from "@/components/searchable-select";
import { QueryError } from "@/components/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, unwrap } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { isAdmin, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  actionOptions,
  activeCount,
  type DoneBy,
  exportUrl,
  NO_FILTERS,
  PAGE_SIZE,
  RANGES,
  type Range,
  readFilters,
  toApiQuery,
  type UrlFilters,
  writeFilters,
} from "./filters";
import { LogDetails } from "./log-details";

const DONE_BY: { value: DoneBy; label: string; hint: string }[] = [
  { value: "", label: "Anyone", hint: "People and the system" },
  { value: "USER", label: "People", hint: "Someone on the team" },
  { value: "SYSTEM", label: "System", hint: "Automatic sending, checks, alerts" },
];

export function LogsView() {
  const me = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const filters = readFilters(useSearchParams());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const admin = isAdmin(me.role);

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
  const users = useQuery({ queryKey: ["users"], queryFn: () => unwrap(api.GET("/api/users")), enabled: admin });
  const campaigns = useQuery({ queryKey: ["campaigns"], queryFn: () => unwrap(api.GET("/api/campaigns")) });
  const mailboxes = useQuery({
    queryKey: ["mailboxes", "with-archived"],
    queryFn: () => unwrap(api.GET("/api/mailboxes", { params: { query: { include_archived: true } } })),
  });

  function update(changes: Partial<UrlFilters>) {
    setExpanded(null);
    router.replace(`${pathname}${writeFilters({ ...filters, page: 1, ...changes })}`, { scroll: false });
  }

  // The search box updates the list as you type, a moment after you stop.
  const [draft, setDraft] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const typeSearch = (value: string) => {
    setDraft(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // Read the URL afresh: other filters may have changed while typing.
      const current = readFilters(new URLSearchParams(window.location.search));
      router.replace(`${pathname}${writeFilters({ ...current, page: 1, q: value })}`, { scroll: false });
    }, 350);
  };
  const clearSearch = () => {
    clearTimeout(timer.current);
    setDraft("");
  };
  const clearAll = () => {
    clearSearch();
    update({ ...NO_FILTERS });
  };
  const removeFilter = (changes: Partial<UrlFilters>) => {
    if ("q" in changes) clearSearch();
    update(changes);
  };

  const actionOpts = actionOptions(actions.data ?? []);
  const userOpts = (users.data ?? []).map((u) => ({ value: String(u.id), label: u.name, hint: u.email }));
  const campaignOpts = (campaigns.data ?? []).map((c) => ({ value: String(c.id), label: c.name }));
  const mailboxOpts = (mailboxes.data ?? []).map((m) => ({
    value: String(m.id),
    label: m.email,
    hint: m.archived_at ? "archived" : undefined,
  }));
  const nameOf = (opts: { value: string; label: string }[], v: string) => opts.find((o) => o.value === v)?.label ?? `#${v}`;

  const count = activeCount(filters);
  const moreCount = count - (filters.q.trim() ? 1 : 0) - filters.actions.length - (filters.range ? 1 : 0);
  const total = logs.data?.total ?? 0;
  const firstRow = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(filters.page * PAGE_SIZE, total);

  // One removable chip per active filter value.
  const chips: { key: string; label: ReactNode; remove: Partial<UrlFilters> }[] = [
    ...(filters.q.trim()
      ? [{ key: "q", label: <>Search: &ldquo;{filters.q.trim()}&rdquo;</>, remove: { q: "" } }]
      : []),
    ...filters.actions.map((a) => ({
      key: `a-${a}`,
      label: <>Action: {nameOf(actionOpts, a)}</>,
      remove: { actions: filters.actions.filter((x) => x !== a) },
    })),
    ...(filters.range && (filters.range !== "custom" || filters.from || filters.to)
      ? [
          {
            key: "range",
            label:
              filters.range === "custom"
                ? `${filters.from ? formatDate(filters.from) : "Start"} – ${filters.to ? formatDate(filters.to) : "now"}`
                : RANGES.find((r) => r.value === filters.range)?.label,
            remove: { range: "" as const, from: "", to: "" },
          },
        ]
      : []),
    ...filters.campaigns.map((c) => ({
      key: `c-${c}`,
      label: <>Campaign: {nameOf(campaignOpts, c)}</>,
      remove: { campaigns: filters.campaigns.filter((x) => x !== c) },
    })),
    ...filters.mailboxes.map((m) => ({
      key: `m-${m}`,
      label: <>Mailbox: {nameOf(mailboxOpts, m)}</>,
      remove: { mailboxes: filters.mailboxes.filter((x) => x !== m) },
    })),
    ...filters.actors.map((u) => ({
      key: `u-${u}`,
      label: <>User: {nameOf(userOpts, u)}</>,
      remove: { actors: filters.actors.filter((x) => x !== u) },
    })),
    ...(filters.by
      ? [{ key: "by", label: `Done by: ${DONE_BY.find((d) => d.value === filters.by)?.label}`, remove: { by: "" as const } }]
      : []),
    ...(filters.problems ? [{ key: "problems", label: "Problems only", remove: { problems: false } }] : []),
    ...(filters.entityType || filters.entityId
      ? [
          {
            key: "item",
            label: (
              <>
                Item: {filters.entityType || "item"}
                {filters.entityId && <span className="font-mono"> #{filters.entityId}</span>}
              </>
            ),
            remove: { entityType: "", entityId: "" },
          },
        ]
      : []),
  ];

  const dateFields = (
    <div className="flex flex-wrap items-end gap-3">
      <FilterField label="From" id="filter-from">
        <Input
          id="filter-from"
          type="date"
          className="w-40"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => update({ range: "custom", from: e.target.value })}
        />
      </FilterField>
      <FilterField label="To" id="filter-to">
        <Input
          id="filter-to"
          type="date"
          className="w-40"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => update({ range: "custom", to: e.target.value })}
        />
      </FilterField>
    </div>
  );

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

      <div className="grid gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={draft}
              onChange={(e) => typeSearch(e.target.value)}
              placeholder="Search email, subject, mailbox, IP…"
              aria-label="Search the activity log"
              className="pl-8"
            />
          </div>
          <MultiSelect
            id="filter-action"
            label="Action"
            className="w-52"
            noun="actions"
            allLabel="All actions"
            values={filters.actions}
            onChange={(v) => update({ actions: v })}
            options={actionOpts}
          />
          <SearchableSelect
            id="filter-range"
            label="When"
            className="w-40"
            value={filters.range || "any"}
            onValueChange={(v) => update({ range: (v === "any" ? "" : v) as Range, from: "", to: "" })}
            options={RANGES.map((r) => ({ value: r.value || "any", label: r.label }))}
          />
          {filters.range === "custom" && dateFields}
          <Button
            variant={filters.problems ? "secondary" : "outline"}
            aria-pressed={filters.problems}
            onClick={() => update({ problems: !filters.problems })}
          >
            <TriangleAlertIcon data-icon="inline-start" /> Problems only
          </Button>
          <Button variant="outline" onClick={() => setMoreOpen(true)} className="sm:ml-auto">
            <SlidersHorizontalIcon data-icon="inline-start" /> More filters
            {moreCount > 0 && (
              <Badge className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 tabular-nums">{moreCount}</Badge>
            )}
          </Button>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
            {chips.map((c) => (
              <Badge key={c.key} variant="secondary" className="h-7 max-w-full gap-1 pr-1 font-normal">
                <span className="min-w-0 truncate">{c.label}</span>
                <Button variant="ghost" size="icon-xs" aria-label="Remove this filter" onClick={() => removeFilter(c.remove)}>
                  <XIcon />
                </Button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Pick as many as you like. Within a filter any ticked choice matches; different filters must all match.
            </SheetDescription>
          </SheetHeader>
          <div className="grid content-start gap-5 overflow-y-auto p-4">
            <FilterField label="Search" id="sheet-search">
              <Input
                id="sheet-search"
                type="search"
                value={draft}
                onChange={(e) => typeSearch(e.target.value)}
                placeholder="Email, subject, mailbox, IP…"
              />
            </FilterField>
            <FilterField label="Action" id="sheet-action">
              <MultiSelect
                id="sheet-action"
                className="w-full"
                noun="actions"
                allLabel="All actions"
                values={filters.actions}
                onChange={(v) => update({ actions: v })}
                options={actionOpts}
              />
            </FilterField>
            <FilterField label="Campaign" id="sheet-campaign">
              <MultiSelect
                id="sheet-campaign"
                className="w-full"
                noun="campaigns"
                allLabel="All campaigns"
                values={filters.campaigns}
                onChange={(v) => update({ campaigns: v })}
                options={campaignOpts}
              />
            </FilterField>
            <FilterField label="Mailbox" id="sheet-mailbox">
              <MultiSelect
                id="sheet-mailbox"
                className="w-full"
                noun="mailboxes"
                allLabel="All mailboxes"
                values={filters.mailboxes}
                onChange={(v) => update({ mailboxes: v })}
                options={mailboxOpts}
              />
            </FilterField>
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-xs text-muted-foreground">Done by</legend>
              <div className="grid grid-cols-3 gap-1.5">
                {DONE_BY.map((d) => (
                  <Button
                    key={d.value || "any"}
                    type="button"
                    size="sm"
                    variant={filters.by === d.value ? "default" : "outline"}
                    aria-pressed={filters.by === d.value}
                    title={d.hint}
                    onClick={() => update({ by: d.value })}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </fieldset>
            {admin && (
              <FilterField label="User" id="sheet-user">
                <MultiSelect
                  id="sheet-user"
                  className="w-full"
                  noun="people"
                  allLabel="Anyone"
                  values={filters.actors}
                  onChange={(v) => update({ actors: v })}
                  options={userOpts}
                />
              </FilterField>
            )}
            <FilterField label="When" id="sheet-range">
              <SearchableSelect
                id="sheet-range"
                className="w-full"
                value={filters.range || "any"}
                onValueChange={(v) => update({ range: (v === "any" ? "" : v) as Range, from: "", to: "" })}
                options={RANGES.map((r) => ({ value: r.value || "any", label: r.label }))}
              />
            </FilterField>
            {filters.range === "custom" && dateFields}
            <Label className="flex items-start gap-2 font-normal">
              <Checkbox
                className="mt-0.5"
                checked={filters.problems}
                onCheckedChange={(on) => update({ problems: on === true })}
              />
              <span className="grid gap-0.5">
                <span>Problems only</span>
                <span className="text-xs text-muted-foreground">
                  Failed sends, bounces, delays, login failures, paused mailboxes and new alerts.
                </span>
              </span>
            </Label>
          </div>
          <SheetFooter className="mt-auto flex-row justify-between border-t">
            <Button variant="ghost" onClick={clearAll} disabled={count === 0}>
              Clear all
            </Button>
            <Button onClick={() => setMoreOpen(false)}>
              Show {logs.data ? total.toLocaleString() : "…"} {total === 1 ? "entry" : "entries"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
                      {count > 0 ? "No activity matches these filters." : "No activity yet."}
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

function FilterField({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
