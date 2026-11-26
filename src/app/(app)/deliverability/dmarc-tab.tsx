"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Limited } from "@/components/long-list";
import { QueryError } from "@/components/query-error";
import { StatusBadge } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { DELIVERABILITY_KEY, percent } from "@/lib/deliverability";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const DMARC_KEY = ["deliverability", "dmarc"] as const;

export function DmarcTab({ setup, editable }: { setup: Schemas["SetupState"]; editable: boolean }) {
  const queryClient = useQueryClient();
  const dmarc = useQuery({ queryKey: DMARC_KEY, queryFn: () => unwrap(api.GET("/api/deliverability/dmarc")) });
  const check = useMutation({
    mutationFn: () => unwrap(api.POST("/api/deliverability/dmarc/check")),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: DMARC_KEY });
      queryClient.invalidateQueries({ queryKey: DELIVERABILITY_KEY });
      const result = r as { error?: string; reports?: number };
      if (result.error) toast.error(result.error);
      else toast.success(`${result.reports ?? 0} new report${result.reports === 1 ? "" : "s"}.`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (dmarc.error) return <QueryError error={dmarc.error} onRetry={() => dmarc.refetch()} />;
  if (dmarc.isPending) return <Skeleton className="h-64" />;
  const d = dmarc.data;
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <CardTitle>DMARC reports</CardTitle>
            <CardDescription>
              Gmail, Outlook, Yahoo and others send a daily report of every email they saw from your domain and whether
              it passed SPF or DKIM.{" "}
              {setup.dmarc_configured
                ? setup.dmarc_error
                  ? `Reading ${setup.dmarc_email} failed: ${setup.dmarc_error}`
                  : `Read from ${setup.dmarc_email} every 6 hours${setup.dmarc_checked_at ? `, last ${formatRelative(setup.dmarc_checked_at)}` : ""}.`
                : "No reports mailbox is set up yet (Settings → Deliverability)."}
            </CardDescription>
          </div>
          {editable && setup.dmarc_configured && (
            <Button variant="outline" size="sm" onClick={() => check.mutate()} disabled={check.isPending}>
              <RefreshCwIcon data-icon="inline-start" className={cn(check.isPending && "animate-spin")} /> Read now
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          {d.rates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports in the last {d.days} days.</p>
          ) : (
            <div className="flex flex-wrap gap-6">
              {d.rates.map((r) => (
                <div key={r.domain} className="grid gap-0.5">
                  <span className="text-xs text-muted-foreground">{r.domain}, last {d.days} days</span>
                  <span className="text-2xl font-semibold tabular-nums">{percent(r.passed, r.total, 1)}</span>
                  <span className="text-xs text-muted-foreground">
                    passed, of {r.total.toLocaleString()} emails
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {d.sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Servers sending as your domain</CardTitle>
            <CardDescription>
              Your own mail server should pass. A server that fails is either someone pretending to be you, or a service
              you use (a newsletter tool, say) that isn&apos;t in your SPF record or signing with DKIM yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid px-0">
            <Limited items={d.sources} limit={10} noun="more servers" buttonClassName="ml-4">
            {(sources) => (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Server</TableHead>
                  <TableHead>Emails</TableHead>
                  <TableHead>Passed</TableHead>
                  <TableHead>DKIM / SPF pass</TableHead>
                  <TableHead className="pr-6">Reported by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((s) => {
                  const ok = s.passed / Math.max(s.emails, 1);
                  return (
                    <TableRow key={`${s.domain}-${s.source_ip}`}>
                      <TableCell className="pl-6">
                        <div className="grid leading-tight">
                          <span className="font-mono text-xs">{s.source_ip}</span>
                          <span className="text-xs text-muted-foreground">{s.domain}</span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{s.emails.toLocaleString()}</TableCell>
                      <TableCell>
                        <StatusBadge tone={ok >= 0.95 ? "good" : ok >= 0.5 ? "warn" : "bad"}>
                          {percent(s.passed, s.emails)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">
                        {percent(s.dkim_pass, s.emails)} / {percent(s.spf_pass, s.emails)}
                      </TableCell>
                      <TableCell className="pr-6 text-sm text-muted-foreground">{s.reporters.join(", ")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            )}
            </Limited>
          </CardContent>
        </Card>
      )}
      {d.reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Latest reports</CardTitle>
          </CardHeader>
          <CardContent className="grid px-0">
            <Limited items={d.reports} limit={10} noun="more reports" buttonClassName="ml-4">
            {(reports) => (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">From</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead className="pr-6">Passed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-6">{r.reporter}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(r.begin_at)} – {formatDate(r.end_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">p={r.policy ?? "?"}</TableCell>
                    <TableCell className="pr-6 tabular-nums">
                      {r.passed.toLocaleString()} of {r.emails.toLocaleString()} ({percent(r.passed, r.emails)})
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
            </Limited>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
