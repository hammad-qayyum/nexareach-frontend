"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import { NAV } from "@/lib/nav";
import { useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export function Dashboard() {
  const user = useCurrentUser();
  const upcoming = NAV.flatMap((g) => g.items)
    .filter((i) => i.milestone)
    .sort((a, b) => a.milestone! - b.milestone!);

  return (
    <div className="grid gap-6">
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} description="Sending, replies and deliverability will show here as they're built." />
      <div className="grid gap-4 lg:grid-cols-3">
        <RecentActivity className="lg:col-span-2" />
        <div className="grid content-start gap-4">
          <SystemHealth />
          <Card>
            <CardHeader>
              <CardTitle>Coming next</CardTitle>
              <CardDescription>Phase 1 pages still to be built.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                {upcoming.slice(0, 5).map((item) => (
                  <li key={item.href} className="flex items-center gap-2">
                    <item.icon className="size-4 text-muted-foreground" />
                    <span className="flex-1">{item.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">M{item.milestone}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RecentActivity({ className }: { className?: string }) {
  const logs = useQuery({
    queryKey: ["logs", "recent"],
    queryFn: () => unwrap(api.GET("/api/logs", { params: { query: { limit: 8 } } })),
  });

  return (
    <Card className={className}>
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
