"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-dot";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { CampaignStatusBadge } from "./campaigns/campaign-status";
import { doneShare } from "./campaigns/campaigns-view";
import { MAILBOX_STATUS, MAILBOXES_QUERY_KEY } from "./mailboxes/mailboxes-view";
import { EmailsPerDayChart } from "./reports/emails-per-day-chart";
import { useSummary } from "./reports/reports-view";
import { cn } from "@/lib/utils";

export function Dashboard() {
  const user = useCurrentUser();
  return (
    <div className="grid gap-6">
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} description="Today at a glance." />
      <TodayTiles />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-4 lg:col-span-2">
          <LastWeek />
          <ActiveCampaigns />
          <RecentActivity />
        </div>
        <div className="grid content-start gap-4">
          <MailboxesToday />
          <SystemHealth />
        </div>
      </div>
    </div>
  );
}

function useMailboxes() {
  return useQuery({
    queryKey: [...MAILBOXES_QUERY_KEY],
    queryFn: () => unwrap(api.GET("/api/mailboxes")),
    refetchInterval: 60_000,
  });
}

function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(api.GET("/api/campaigns")),
    refetchInterval: 15_000,
  });
}

function TodayTiles() {
  const mailboxes = useMailboxes();
  const campaigns = useCampaigns();
  const week = useSummary(7);
  const duplicates = useQuery({
    queryKey: ["duplicates", "count"],
    queryFn: () => unwrap(api.GET("/api/duplicates/count")),
    refetchInterval: 60_000,
  });
  const active = (mailboxes.data ?? []).filter((m) => m.status === "ACTIVE");
  const sentToday = (mailboxes.data ?? []).reduce((n, m) => n + m.sent_today, 0);
  const capToday = active.reduce((n, m) => n + m.daily_cap, 0);
  const running = (campaigns.data ?? []).filter((c) => c.status === "RUNNING").length;
  const failedToday = week.data?.days.at(-1)?.failed ?? 0;
  const pending = duplicates.data?.pending ?? 0;

  const tiles: { label: string; value: string; note: string; href: string; loading: boolean }[] = [
    {
      label: "Sent today",
      value: sentToday.toLocaleString(),
      note: capToday ? `of ${capToday.toLocaleString()} allowed across ${active.length} mailbox${active.length === 1 ? "" : "es"}` : "No active mailboxes",
      href: "/mailboxes",
      loading: mailboxes.isPending,
    },
    {
      label: "Failed today",
      value: failedToday.toLocaleString(),
      note: failedToday ? "Open Reports to see where" : "Nothing failed",
      href: "/reports",
      loading: week.isPending,
    },
    {
      label: "Running campaigns",
      value: running.toLocaleString(),
      note: running ? "Sending in their hours" : "None running",
      href: "/campaigns",
      loading: campaigns.isPending,
    },
    {
      label: "Duplicates to review",
      value: pending.toLocaleString(),
      note: pending ? "Not emailed until you decide" : "All clear",
      href: "/leads/duplicates",
      loading: duplicates.isPending,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <Link key={t.label} href={t.href} className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <Card className="h-full gap-1 py-4 transition-colors group-hover:bg-muted/40">
            <CardContent className="grid gap-1 px-4">
              <span className="text-xs text-muted-foreground">{t.label}</span>
              {t.loading ? <Skeleton className="h-8 w-16" /> : <span className="text-2xl font-semibold tabular-nums">{t.value}</span>}
              <span className="text-xs text-muted-foreground">{t.note}</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function LastWeek() {
  const week = useSummary(7);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Last 7 days</CardTitle>
        <CardDescription>
          {week.data ? `${week.data.totals.sent.toLocaleString()} sent, ${week.data.totals.failed.toLocaleString()} failed.` : "Emails per day."}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/reports">
              Reports <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {week.error ? (
          <QueryError error={week.error} onRetry={() => week.refetch()} />
        ) : week.isPending ? (
          <Skeleton className="h-48" />
        ) : (
          <EmailsPerDayChart days={week.data.days} className="h-48" />
        )}
      </CardContent>
    </Card>
  );
}

function ActiveCampaigns() {
  const campaigns = useCampaigns();
  const live = (campaigns.data ?? []).filter((c) => c.status === "RUNNING" || c.status === "PAUSED");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaigns in progress</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/campaigns">
              All campaigns <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {campaigns.error ? (
          <QueryError error={campaigns.error} onRetry={() => campaigns.refetch()} />
        ) : campaigns.isPending ? (
          <Skeleton className="h-16" />
        ) : live.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No campaign is running or paused.</p>
        ) : (
          <ul className="grid gap-4">
            {live.map((c) => (
              <li key={c.id} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/campaigns/${c.id}`} className="truncate font-medium hover:underline">
                    {c.name}
                  </Link>
                  <CampaignStatusBadge status={c.status} />
                </div>
                <Progress value={doneShare(c)} className="h-1.5" aria-label={`${c.name} progress`} />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {c.counts.sent.toLocaleString()} sent · {(c.counts.waiting + c.counts.sending).toLocaleString()} waiting
                  {c.counts.failed > 0 && ` · ${c.counts.failed} failed`} · {doneShare(c)}% done
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function MailboxesToday() {
  const mailboxes = useMailboxes();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mailboxes today</CardTitle>
        <CardDescription>Sent today against each daily limit.</CardDescription>
      </CardHeader>
      <CardContent>
        {mailboxes.error ? (
          <QueryError error={mailboxes.error} onRetry={() => mailboxes.refetch()} />
        ) : mailboxes.isPending ? (
          <Skeleton className="h-24" />
        ) : mailboxes.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mailboxes yet.{" "}
            <Link href="/mailboxes" className="font-medium text-primary underline-offset-4 hover:underline">
              Add one
            </Link>
          </p>
        ) : (
          <ul className="grid gap-4">
            {mailboxes.data.map((m) => (
              <li key={m.id} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{m.email}</span>
                  <StatusBadge tone={MAILBOX_STATUS[m.status].tone}>{MAILBOX_STATUS[m.status].label}</StatusBadge>
                </div>
                <Progress value={Math.min(100, (m.sent_today / m.daily_cap) * 100)} className="h-1.5" aria-label={`${m.email} sent today`} />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {m.sent_today} / {m.daily_cap}
                  {m.status === "ACTIVE" && m.next_send_at && new Date(m.next_send_at) > new Date()
                    ? ` · next ${formatRelative(m.next_send_at)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity() {
  const logs = useQuery({
    queryKey: ["logs", "recent"],
    queryFn: () => unwrap(api.GET("/api/logs", { params: { query: { limit: 8 } } })),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>The latest entries in the activity log.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/logs">
              View all <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {logs.error ? (
          <QueryError error={logs.error} onRetry={() => logs.refetch()} />
        ) : logs.isPending ? (
          <div className="grid gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : logs.data.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="divide-y">
            {logs.data.items.map((log) => (
              <li key={log.id} className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{log.action}</code>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{log.actor_label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(log.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

type Health = Schemas["HealthOut"];

function SystemHealth() {
  // /api/health answers 503 with the same body when something is down, so read it either way.
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async (): Promise<Health> => {
      const res = await fetch("/api/health", { credentials: "include" });
      return res.json();
    },
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>System</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {health.isPending ? (
          <Skeleton className="h-12" />
        ) : (
          <>
            <HealthRow label="Database" ok={health.data?.database ?? false} />
            <HealthRow
              label="Background worker"
              ok={health.data?.worker ?? false}
              detail={
                health.data && !health.data.worker
                  ? health.data.worker_last_seen
                    ? `Last seen ${formatRelative(health.data.worker_last_seen)}`
                    : "Never seen"
                  : undefined
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HealthRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2 rounded-full", ok ? "bg-success" : "bg-destructive")} aria-hidden />
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted-foreground">{detail ?? (ok ? "Running" : "Down")}</span>
    </div>
  );
}
