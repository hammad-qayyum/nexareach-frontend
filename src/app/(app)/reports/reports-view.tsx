"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { CampaignStatusBadge } from "../campaigns/campaign-status";
import { EmailsPerDayChart } from "./emails-per-day-chart";

const RANGES = [7, 30, 90] as const;

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function useSummary(days: number) {
  return useQuery({
    queryKey: ["reports", "summary", days],
    queryFn: () => unwrap(api.GET("/api/reports/summary", { params: { query: { days, tz: browserTimezone() } } })),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : "0%");

export function ReportsView() {
  const [days, setDays] = useState<number>(30);
  const summary = useSummary(days);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Reports"
        description="What went out, from which mailbox and for which campaign. Days follow your computer's timezone."
        actions={
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-40" aria-label="Period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r} value={String(r)}>
                  Last {r} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {summary.error ? (
        <QueryError error={summary.error} onRetry={() => summary.refetch()} />
      ) : summary.isPending ? (
        <div className="grid gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <Report data={summary.data} days={days} />
      )}
    </div>
  );
}

function Report({ data, days }: { data: Schemas["SummaryOut"]; days: number }) {
  const { totals } = data;
  const tiles = [
    { label: "Emails sent", value: totals.sent.toLocaleString() },
    { label: "People reached", value: totals.people.toLocaleString() },
    { label: "Failed", value: totals.failed.toLocaleString(), note: `${pct(totals.failed, totals.sent + totals.failed)} of attempts` },
    { label: "Skipped", value: totals.skipped.toLocaleString(), note: "Do-not-contact or emailed recently" },
  ];
  const busiest = Math.max(1, ...data.mailboxes.map((m) => m.sent + m.failed));

  return (
    <>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="gap-1 py-4">
            <CardContent className="grid gap-1 px-4">
              <dt className="text-xs text-muted-foreground">{t.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{t.value}</dd>
              {t.note && <dd className="text-xs text-muted-foreground">{t.note}</dd>}
            </CardContent>
          </Card>
        ))}
      </dl>

      <Card>
        <CardHeader>
          <CardTitle>Emails per day</CardTitle>
          <CardDescription>Last {days} days. Hover a bar for the numbers.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <EmailsPerDayChart days={data.days} />
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Show as a table</summary>
            <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Day</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="pr-4 text-right">Failed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.days].reverse().map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="pl-4">{format(parseISO(d.date), "EEE d MMM")}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.sent}</TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">{d.failed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Per mailbox</CardTitle>
            <CardDescription>Emails each mailbox sent in this period.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.mailboxes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing sent in this period.</p>
            ) : (
              <ul className="grid gap-4">
                {data.mailboxes.map((m) => (
                  <li key={m.id} className="grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate">{m.email}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className="font-medium">{m.sent.toLocaleString()} sent</span>
                        {m.failed > 0 && <span className="text-muted-foreground"> · {m.failed} failed</span>}
                      </span>
                    </div>
                    <div className="flex h-2 gap-0.5" aria-hidden>
                      <div className="rounded-l-sm bg-chart-sent" style={{ width: `${(m.sent / busiest) * 100}%` }} />
                      {m.failed > 0 && (
                        <div className="rounded-r-sm bg-chart-failed" style={{ width: `${(m.failed / busiest) * 100}%` }} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per campaign</CardTitle>
            <CardDescription>Campaigns that sent in this period or are still running.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.campaigns.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No campaigns in this period.</p>
            ) : (
              <ul className="grid gap-4">
                {data.campaigns.map((c) => (
                  <li key={c.id} className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <Link href={`/campaigns/${c.id}`} className="truncate font-medium hover:underline">
                        {c.name}
                      </Link>
                      <CampaignStatusBadge status={c.status} />
                    </div>
                    <Progress value={c.total ? (c.done / c.total) * 100 : 0} className="h-1.5" aria-label={`${c.name} progress`} />
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                      <span>
                        {c.sent.toLocaleString()} sent{c.failed > 0 && ` · ${c.failed} failed`} in this period
                      </span>
                      <span>
                        {c.done.toLocaleString()} of {c.total.toLocaleString()} done
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
