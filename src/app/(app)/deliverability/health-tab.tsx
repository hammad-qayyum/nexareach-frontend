"use client";

import { useQuery } from "@tanstack/react-query";
import { HistoryIcon } from "lucide-react";
import { useState } from "react";
import { Limited } from "@/components/long-list";
import { QueryError } from "@/components/query-error";
import { StatusBadge } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { HEALTH } from "@/lib/deliverability";
import { formatDateTime, formatRelative } from "@/lib/format";

export const HEALTH_KEY = ["deliverability", "health"] as const;

type Check = Schemas["HealthCheckOut"];

const KIND: Record<Check["kind"], { label: string; what: string }> = {
  MX: { label: "MX", what: "Where mail to the domain goes (replies and bounces need it)" },
  SPF: { label: "SPF", what: "Which servers may send as the domain" },
  DKIM: { label: "DKIM", what: "The key that signs every email" },
  DMARC: { label: "DMARC", what: "What receivers do when SPF/DKIM fail, and where reports go" },
  CERTIFICATE: { label: "Certificate", what: "The mail server's secure-connection certificate" },
  BLACKLIST: { label: "Blacklists", what: "Spam blacklists (SpamCop, Barracuda, PSBL, Spamhaus with a key)" },
};
const ORDER: Check["kind"][] = ["MX", "SPF", "DKIM", "DMARC", "CERTIFICATE", "BLACKLIST"];

export function HealthTab({ editable }: { editable: boolean }) {
  const health = useQuery({ queryKey: HEALTH_KEY, queryFn: () => unwrap(api.GET("/api/deliverability/health")) });
  const [history, setHistory] = useState<Check | null>(null);

  if (health.error) return <QueryError error={health.error} onRetry={() => health.refetch()} />;
  if (health.isPending) return <Skeleton className="h-64" />;
  const results = [...health.data.results].sort(
    (a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.target.localeCompare(b.target),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Health checks</CardTitle>
        <CardDescription>
          Checked every morning (06:20 Pakistan time)
          {editable ? " and whenever you press Run checks now" : ""}.{" "}
          {health.data.checked_at ? `Last run ${formatRelative(health.data.checked_at)}.` : "Not run yet."} A broken record
          or a blacklisting pauses the mailboxes it affects; an expiring certificate only warns.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {results.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">
            {health.data.note ??
              (health.data.checked_at
                ? "No sending domains to check."
                : "No results yet. They appear after the first daily run, or press Run checks now.")}
          </p>
        ) : (
          // Problems first; with many domains the OK rows fold away.
          <Limited
            items={[...results].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])}
            limit={Math.max(12, results.filter((r) => r.status !== "OK").length)}
            noun="more checks"
            buttonClassName="ml-4"
          >
          {(rows) => (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Check</TableHead>
                <TableHead>For</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-12 pr-6">
                  <span className="sr-only">History</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.kind}-${r.target}`}>
                  <TableCell className="pl-6 align-top">
                    <div className="grid leading-tight">
                      <span className="font-medium">{KIND[r.kind].label}</span>
                      <span className="max-w-56 text-xs whitespace-normal text-muted-foreground">{KIND[r.kind].what}</span>
                    </div>
                  </TableCell>
                  <TableCell className="align-top font-mono text-xs">{r.target}</TableCell>
                  <TableCell className="align-top">
                    <StatusBadge tone={HEALTH[r.status].tone}>{HEALTH[r.status].label}</StatusBadge>
                  </TableCell>
                  <TableCell className="max-w-md align-top text-sm break-words whitespace-normal">{r.detail}</TableCell>
                  <TableCell className="pr-6 align-top">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setHistory(r)}
                      aria-label={`History of ${KIND[r.kind].label} for ${r.target}`}
                    >
                      <HistoryIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
          </Limited>
        )}
      </CardContent>
      <HistoryDialog check={history} onClose={() => setHistory(null)} />
    </Card>
  );
}

const STATUS_ORDER: Record<Check["status"], number> = { FAIL: 0, WARN: 1, UNKNOWN: 2, OK: 3 };

function HistoryDialog({ check, onClose }: { check: Check | null; onClose: () => void }) {
  const history = useQuery({
    queryKey: ["deliverability", "health", "history", check?.kind, check?.target],
    queryFn: () =>
      unwrap(
        api.GET("/api/deliverability/health/history", {
          params: { query: { kind: check!.kind, target: check!.target } },
        }),
      ),
    enabled: !!check,
  });
  return (
    <Dialog open={!!check} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {check ? KIND[check.kind].label : ""} history: {check?.target}
          </DialogTitle>
          <DialogDescription>Every result in the last 30 days, newest first.</DialogDescription>
        </DialogHeader>
        {history.isPending ? (
          <Skeleton className="h-32" />
        ) : (
          <ul className="grid max-h-96 gap-2 overflow-y-auto">
            {history.data?.map((h, i) => (
              <li key={i} className="grid gap-1 rounded-md border p-2 text-sm">
                <span className="flex items-center justify-between gap-2">
                  <StatusBadge tone={HEALTH[h.status].tone}>{HEALTH[h.status].label}</StatusBadge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(h.checked_at)}</span>
                </span>
                <span className="break-words">{h.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
