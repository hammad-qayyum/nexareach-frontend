"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronRightIcon, DownloadIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Pager } from "@/components/pager";
import { SearchableSelect } from "@/components/searchable-select";
import { QueryError } from "@/components/query-error";
import { StatusBadge } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { DELIVERABILITY_KEY, DELIVERY_SOURCE, DELIVERY_STATUS, type DeliveryStatus } from "@/lib/deliverability";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const PAGE_SIZE = 50;

type Filters = { mailbox: string; status: string; source: string; days: string; q: string };

function toQuery(f: Filters) {
  return {
    mailbox_id: f.mailbox ? Number(f.mailbox) : undefined,
    status: (f.status || undefined) as DeliveryStatus | undefined,
    source: (f.source || undefined) as Schemas["DeliveryEventOut"]["source"] | undefined,
    days: f.days ? Number(f.days) : undefined,
    q: f.q.trim() || undefined,
  };
}

export function ServerLogTab({
  mailboxes,
  setup,
  editable,
}: {
  mailboxes: Schemas["MailboxCard"][];
  setup: Schemas["SetupState"];
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({ mailbox: "", status: "", source: "", days: "30", q: "" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const query = toQuery(filters);
  const log = useQuery({
    queryKey: ["deliverability", "log", query, page],
    queryFn: () =>
      unwrap(
        api.GET("/api/deliverability/log", {
          params: { query: { ...query, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE } },
        }),
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const sync = useMutation({
    mutationFn: () => unwrap(api.POST("/api/deliverability/log/sync")),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["deliverability", "log"] });
      queryClient.invalidateQueries({ queryKey: DELIVERABILITY_KEY });
      const result = r as { error?: string; added?: number };
      if (result.error) toast.error(result.error);
      else toast.success(`cPanel read: ${result.added ?? 0} new line${result.added === 1 ? "" : "s"}.`);
    },
    onError: (e) => toast.error(e.message),
  });

  function update(changes: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...changes }));
    setPage(1);
    setOpen(null);
  }
  const exportParams = new URLSearchParams(
    Object.entries(query).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <CardTitle>Mail-server log</CardTitle>
          <CardDescription>
            Every campaign email and follow-up: our server&apos;s answer when it was sent, then what cPanel&apos;s delivery
            log and bounce emails said.{" "}
            {setup.cpanel_configured
              ? setup.cpanel_error
                ? `cPanel couldn't be read: ${setup.cpanel_error}`
                : setup.cpanel_synced_at
                  ? `cPanel read ${formatRelative(setup.cpanel_synced_at)} (every 10 minutes).`
                  : "cPanel is read every 10 minutes."
              : "cPanel isn't connected, so only sends and bounces appear."}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && setup.cpanel_configured && (
            <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCwIcon data-icon="inline-start" className={cn(sync.isPending && "animate-spin")} /> Read cPanel now
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/deliverability/log/export?${exportParams}`} download>
              <DownloadIcon data-icon="inline-start" /> Export CSV
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 px-0">
        <div className="flex flex-wrap items-end gap-3 px-6">
          <Field label="Mailbox" id="log-mailbox">
            <SearchableSelect
              id="log-mailbox"
              className="w-52"
              searchLabel="Search mailboxes"
              value={filters.mailbox || ALL}
              onValueChange={(v) => update({ mailbox: v === ALL ? "" : v })}
              options={[
                { value: ALL, label: "All mailboxes", divider: true },
                ...mailboxes.map((m) => ({ value: String(m.id), label: m.email })),
              ]}
            />
          </Field>
          <Field label="Result" id="log-status">
            <Select value={filters.status || ALL} onValueChange={(v) => update({ status: v === ALL ? "" : v })}>
              <SelectTrigger id="log-status" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any result</SelectItem>
                {Object.entries(DELIVERY_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="From" id="log-source">
            <Select value={filters.source || ALL} onValueChange={(v) => update({ source: v === ALL ? "" : v })}>
              <SelectTrigger id="log-source" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any source</SelectItem>
                {Object.entries(DELIVERY_SOURCE).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="When" id="log-days">
            <Select value={filters.days || ALL} onValueChange={(v) => update({ days: v === ALL ? "" : v })}>
              <SelectTrigger id="log-days" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 hours</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value={ALL}>All time</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: search });
            }}
          >
            <Field label="Search" id="log-q">
              <Input
                id="log-q"
                className="w-56"
                placeholder="Address, reply text or queue ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </div>
        {log.error ? (
          <div className="px-6">
            <QueryError error={log.error} onRetry={() => log.refetch()} />
          </div>
        ) : log.isPending ? (
          <Skeleton className="mx-6 h-48" />
        ) : log.data.items.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">Nothing matches.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 pl-6">
                  <span className="sr-only">Open</span>
                </TableHead>
                <TableHead>Time</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>From</TableHead>
                <TableHead className="pr-6">Server&apos;s answer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.data.items.map((e) => (
                <Fragment key={e.id}>
                  <TableRow className="cursor-pointer" onClick={() => setOpen(open === e.id ? null : e.id)}>
                    <TableCell className="pl-6">
                      {open === e.id ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.occurred_at)}</TableCell>
                    <TableCell>
                      <div className="grid leading-tight">
                        <span>{e.email || "(forgotten)"}</span>
                        <span className="text-xs text-muted-foreground">{e.mailbox_email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={DELIVERY_STATUS[e.status].tone}>{DELIVERY_STATUS[e.status].label}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{DELIVERY_SOURCE[e.source]}</TableCell>
                    <TableCell className="max-w-80 truncate pr-6 font-mono text-xs" title={e.response ?? ""}>
                      {e.response ?? "—"}
                    </TableCell>
                  </TableRow>
                  {open === e.id && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell />
                      <TableCell colSpan={5} className="pr-6">
                        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
                          <dt className="text-muted-foreground">Campaign</dt>
                          <dd>
                            {e.campaign_id ? (
                              <Link href={`/campaigns/${e.campaign_id}`} className="underline underline-offset-4">
                                {e.campaign_name}
                              </Link>
                            ) : (
                              "—"
                            )}
                            {e.follow_up_step ? ` (follow-up ${e.follow_up_step})` : ""}
                          </dd>
                          <dt className="text-muted-foreground">Receiving server</dt>
                          <dd className="font-mono text-xs">{e.remote_host ?? "—"}</dd>
                          <dt className="text-muted-foreground">Queue ID</dt>
                          <dd className="font-mono text-xs">{e.queue_id ?? "—"}</dd>
                          <dt className="text-muted-foreground">Full answer</dt>
                          <dd className="font-mono text-xs break-words whitespace-pre-wrap">{e.response ?? "—"}</dd>
                        </dl>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
        {log.data && (
          <div className="px-6">
            <Pager page={page} pageSize={PAGE_SIZE} total={log.data.total} onPage={setPage} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
