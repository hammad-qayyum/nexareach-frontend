"use client";

import { nameList, SearchBox, ShowMoreButton, useSearch, useShowMore } from "@/components/long-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, InfoIcon, OctagonAlertIcon, PlayIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { StatusBadge, type Tone } from "@/components/status-dot";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProviderMix } from "@/app/(app)/leads/import/provider-mix";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import {
  ALERT_COUNT_KEY,
  DELIVERABILITY_KEY,
  FOLDER,
  HEALTH,
  pauseReason,
  percent,
} from "@/lib/deliverability";
import { formatDateTime, formatRelative } from "@/lib/format";
import { canEdit, isAdmin, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { DmarcTab } from "./dmarc-tab";
import { HealthTab, HEALTH_KEY } from "./health-tab";
import { PlacementTab } from "./placement-tab";
import { ServerLogTab } from "./server-log-tab";

type Overview = Schemas["DeliverabilityOverview"];
type MailboxCard = Schemas["MailboxCard"];
type AlertItem = Schemas["AlertOut"];

export function DeliverabilityView() {
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const [tab, setTab] = useState("health");
  const overview = useQuery({
    queryKey: DELIVERABILITY_KEY,
    queryFn: () => unwrap(api.GET("/api/deliverability")),
    refetchInterval: 60_000,
  });

  return (
    // minmax(0,1fr): wide tables scroll inside their card instead of widening the page on phones.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader
        title="Deliverability"
        description="Whether your emails reach the inbox: what happened to each one, bounces, your domain's health, placement tests and DMARC reports."
        actions={editable && <RunChecksButton />}
      />
      {overview.error ? (
        <QueryError error={overview.error} onRetry={() => overview.refetch()} />
      ) : overview.isPending ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <SetupNotes overview={overview.data} admin={isAdmin(me.role)} />
          <AlertsCard alerts={overview.data.alerts} editable={editable} />
          <MailboxCards overview={overview.data} />
          <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-4">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="health">Health checks</TabsTrigger>
              <TabsTrigger value="log">Server log</TabsTrigger>
              <TabsTrigger value="placement">Placement tests</TabsTrigger>
              <TabsTrigger value="dmarc">DMARC reports</TabsTrigger>
              <TabsTrigger value="providers">Lead providers</TabsTrigger>
            </TabsList>
            <TabsContent value="health" className="min-w-0">
              <HealthTab editable={editable} />
            </TabsContent>
            <TabsContent value="log" className="min-w-0">
              <ServerLogTab mailboxes={overview.data.mailboxes} setup={overview.data.setup} editable={editable} />
            </TabsContent>
            <TabsContent value="placement" className="min-w-0">
              <PlacementTab mailboxes={overview.data.mailboxes} setup={overview.data.setup} editable={editable} />
            </TabsContent>
            <TabsContent value="dmarc" className="min-w-0">
              <DmarcTab setup={overview.data.setup} editable={editable} />
            </TabsContent>
            <TabsContent value="providers">
              <ProvidersCard overview={overview.data} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function RunChecksButton() {
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: () => unwrap(api.POST("/api/deliverability/health/run")),
    onSuccess: (r) => {
      queryClient.setQueryData(HEALTH_KEY, r);
      queryClient.invalidateQueries({ queryKey: DELIVERABILITY_KEY });
      queryClient.invalidateQueries({ queryKey: ALERT_COUNT_KEY });
      const problems = r.results.filter((x) => x.status === "FAIL").length;
      if (!r.results.length) toast.info(r.note ?? "No domains to check yet.");
      else if (problems) toast.error(`${problems} problem${problems === 1 ? "" : "s"} found. See Health checks.`);
      else toast.success("Checks done. Nothing wrong.");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Button variant="outline" onClick={() => run.mutate()} disabled={run.isPending}>
      <RefreshCwIcon data-icon="inline-start" className={cn(run.isPending && "animate-spin")} />
      {run.isPending ? "Checking…" : "Run checks now"}
    </Button>
  );
}

/** What isn't set up yet, so its numbers are missing. */
function SetupNotes({ overview, admin }: { overview: Overview; admin: boolean }) {
  const s = overview.setup;
  const notes = [
    !s.cpanel_configured && "cPanel's delivery log isn't connected, so \"delivered\" and \"delayed\" aren't known (bounce emails still are).",
    !s.dmarc_configured && "No DMARC reports mailbox is set, so DMARC pass rates are missing.",
    !s.alert_email_mailbox && "No mailbox is chosen for app emails, so alerts only show here (not by email).",
    s.helpers === 0 && "No working helper account, so placement tests can't run (add one on the Warm-up page).",
  ].filter(Boolean) as string[];
  if (!notes.length) return null;
  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>Not everything is set up</AlertTitle>
      <AlertDescription className="grid gap-2">
        <ul className="grid list-disc gap-0.5 pl-4">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <span>
          {admin ? (
            <>
              Set them up in{" "}
              <Link href="/settings#deliverability" className="underline underline-offset-4">
                Settings → Deliverability
              </Link>
              .
            </>
          ) : (
            "An admin can set them up in Settings."
          )}
        </span>
      </AlertDescription>
    </Alert>
  );
}

const ALERT_STATUS: Record<AlertItem["status"], { label: string; tone: Tone }> = {
  OPEN: { label: "New", tone: "bad" },
  ACKNOWLEDGED: { label: "Seen", tone: "warn" },
  RESOLVED: { label: "Resolved", tone: "good" },
};

function AlertsCard({ alerts, editable }: { alerts: AlertItem[]; editable: boolean }) {
  const [history, setHistory] = useState(false);
  const open = useShowMore(alerts, 5);
  const resolved = useQuery({
    queryKey: ["deliverability", "alerts", "resolved"],
    queryFn: () => unwrap(api.GET("/api/deliverability/alerts", { params: { query: { state: "resolved", limit: 50 } } })),
    enabled: history,
  });
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1.5">
          <CardTitle>Alerts</CardTitle>
          <CardDescription>
            With &ldquo;Pause sending on serious problems&rdquo; on (Settings → Alert limits), serious problems pause
            campaign emails from the mailboxes they affect (warm-up carries on); off, they only warn. An alert clears
            itself once the next check finds the problem fixed; sending stays paused until someone resumes it.
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setHistory((h) => !h)}>
          {history ? "Hide resolved" : "Show resolved"}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckIcon className="size-4 text-success" /> No alerts. Everything checked looks fine.
          </p>
        ) : (
          <>
            {open.shown.map((a) => (
              <AlertRow key={a.id} alert={a} editable={editable} />
            ))}
            <ShowMoreButton hidden={open.hidden} all={open.all} onToggle={open.toggle} noun="more alerts" />
          </>
        )}
        {history &&
          (resolved.isPending ? (
            <Skeleton className="h-16" />
          ) : resolved.data?.length ? (
            <div className="grid gap-2 border-t pt-3">
              <span className="text-sm font-medium">Resolved</span>
              <ResolvedAlerts alerts={resolved.data} />
            </div>
          ) : (
            <p className="border-t pt-3 text-sm text-muted-foreground">No resolved alerts yet.</p>
          ))}
      </CardContent>
    </Card>
  );
}

function ResolvedAlerts({ alerts }: { alerts: AlertItem[] }) {
  const more = useShowMore(alerts, 5);
  return (
    <>
      {more.shown.map((a) => (
        <AlertRow key={a.id} alert={a} editable={false} />
      ))}
      <ShowMoreButton hidden={more.hidden} all={more.all} onToggle={more.toggle} noun="more" />
    </>
  );
}

function AlertRow({ alert: a, editable }: { alert: AlertItem; editable: boolean }) {
  const queryClient = useQueryClient();
  const done = (message: string) => {
    queryClient.invalidateQueries({ queryKey: DELIVERABILITY_KEY });
    queryClient.invalidateQueries({ queryKey: ALERT_COUNT_KEY });
    queryClient.invalidateQueries({ queryKey: ["mailboxes"] });
    toast.success(message);
  };
  const acknowledge = useMutation({
    mutationFn: () =>
      unwrap(api.POST("/api/deliverability/alerts/{alert_id}/acknowledge", { params: { path: { alert_id: a.id } } })),
    onSuccess: () => done("Marked as seen."),
    onError: (e) => toast.error(e.message),
  });
  const resume = useMutation({
    mutationFn: () =>
      unwrap(api.POST("/api/deliverability/alerts/{alert_id}/resume", { params: { path: { alert_id: a.id } } })),
    onSuccess: () => done("Campaign emails are going out again."),
    onError: (e) => toast.error(e.message),
  });
  const stillPaused = a.paused_mailboxes.filter((m) => m.paused);
  const critical = a.severity === "CRITICAL" && a.status !== "RESOLVED";
  const Icon = critical ? OctagonAlertIcon : TriangleAlertIcon;
  return (
    <div className={cn("flex flex-wrap gap-3 rounded-lg border p-3", critical && "border-destructive/40 bg-destructive/5")}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", critical ? "text-destructive" : "text-warning")} aria-hidden />
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{a.title}</span>
          <StatusBadge tone={ALERT_STATUS[a.status].tone}>{ALERT_STATUS[a.status].label}</StatusBadge>
        </div>
        <p className="text-sm break-words">{a.message}</p>
        {stillPaused.length > 0 && (
          <p className="text-sm font-medium text-destructive">
            Campaign emails paused from {nameList(stillPaused.map((m) => m.email))}.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Since {formatDateTime(a.opened_at)}
          {a.status === "RESOLVED" && a.resolved_at ? ` · resolved ${formatRelative(a.resolved_at)}` : ""}
          {a.acknowledged_by ? ` · seen by ${a.acknowledged_by}` : ""}
          {a.emailed_at ? " · admins were emailed" : a.email_error ? ` · not emailed: ${a.email_error}` : ""}
        </p>
      </div>
      {editable && a.status !== "RESOLVED" && (
        <div className="flex flex-wrap items-start gap-2">
          {stillPaused.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => resume.mutate()} disabled={resume.isPending}>
              <PlayIcon data-icon="inline-start" /> Resume sending
            </Button>
          )}
          {a.status === "OPEN" && (
            <Button size="sm" variant="ghost" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
              Mark as seen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Mailboxes with something wrong come first, so a team with many mailboxes sees them without scrolling. */
function trouble(m: MailboxCard, limits: Overview["thresholds"]) {
  if (m.status === "ERROR" || m.campaigns_paused_at) return 0;
  if (m.blacklist === "FAIL" || m.dns === "FAIL" || m.bounce_rate.pct > limits.hard_bounce_pct) return 1;
  if (m.status === "PAUSED" || m.blacklist === "WARN" || m.dns === "WARN" || m.bounce_rate.pct > limits.hard_bounce_pct / 2) return 2;
  return 3;
}

function MailboxCards({ overview }: { overview: Overview }) {
  const sorted = [...overview.mailboxes].sort((a, b) => trouble(a, overview.thresholds) - trouble(b, overview.thresholds));
  const search = useSearch(sorted, (m) => `${m.display_name} ${m.email}`);
  const more = useShowMore(search.found, 6);
  if (!overview.mailboxes.length) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          No mailboxes yet.{" "}
          <Link href="/mailboxes" className="underline underline-offset-4">
            Add one
          </Link>{" "}
          to see its numbers here.
        </CardContent>
      </Card>
    );
  }
  const many = overview.mailboxes.length > 6;
  return (
    <div className="grid gap-3">
      {many && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {overview.mailboxes.length} mailboxes, the ones that need a look first.
          </span>
          <SearchBox value={search.q} onChange={search.setQ} label="Search mailboxes" className="w-full sm:w-64" />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {more.shown.map((m) => (
          <MailboxCardView key={m.id} card={m} overview={overview} />
        ))}
      </div>
      {many && search.found.length === 0 && <p className="text-sm text-muted-foreground">No mailbox matches.</p>}
      <ShowMoreButton hidden={more.hidden} all={more.all} onToggle={more.toggle} noun="more mailboxes" className="justify-self-center" />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: Tone }) {
  return (
    <div className="grid content-start gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "bad" && "text-destructive",
          tone === "warn" && "text-warning",
        )}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function MailboxCardView({ card: m, overview }: { card: MailboxCard; overview: Overview }) {
  const limits = overview.thresholds;
  const cpanel = overview.setup.cpanel_configured;
  const bounced = m.hard_bounced + m.soft_bounced;
  const bounceTone: Tone =
    m.bounce_rate.pct > limits.hard_bounce_pct ? "bad" : m.bounce_rate.pct > limits.hard_bounce_pct / 2 ? "warn" : "good";
  const dmarcPct = m.dmarc_total ? ((m.dmarc_passed ?? 0) / m.dmarc_total) * 100 : null;
  const p = m.placement;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="grid min-w-0 leading-tight">
            <CardTitle className="truncate">{m.display_name}</CardTitle>
            <CardDescription className="truncate">{m.email}</CardDescription>
          </div>
          {m.status === "ERROR" ? (
            <StatusBadge tone="bad">Can&apos;t sign in</StatusBadge>
          ) : m.campaigns_paused_at ? (
            <StatusBadge tone="bad">Campaign emails paused</StatusBadge>
          ) : m.status === "PAUSED" ? (
            <StatusBadge tone="muted">Paused</StatusBadge>
          ) : (
            <StatusBadge tone="good">Sending</StatusBadge>
          )}
        </div>
        {m.campaigns_paused_at && (
          <p className="text-sm text-destructive">
            Paused {formatRelative(m.campaigns_paused_at)}: {pauseReason(m.campaigns_paused_reason)}.
          </p>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={`Sent (${overview.period_days} days)`} value={m.sent.toLocaleString()} />
          <Stat
            label="Delivered"
            value={cpanel ? m.delivered.toLocaleString() : "—"}
            sub={cpanel ? percent(m.delivered, m.sent) : "cPanel not connected"}
          />
          <Stat label="Delayed" value={m.deferred.toLocaleString()} tone={m.deferred ? "warn" : undefined} />
          <Stat
            label="Bounced"
            value={bounced.toLocaleString()}
            sub={bounced ? `${m.hard_bounced} hard · ${m.soft_bounced} soft` : undefined}
            tone={m.hard_bounced ? "warn" : undefined}
          />
        </div>
        <div className="grid gap-2 border-t pt-4 text-sm">
          <Row label="Hard-bounce rate">
            {m.bounce_rate.emails ? (
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={bounceTone}>{m.bounce_rate.pct.toFixed(1)}%</StatusBadge>
                <span className="text-xs text-muted-foreground">
                  {m.bounce_rate.hard} in its last {m.bounce_rate.emails} emails
                  {m.bounce_rate.emails < m.bounce_rate.window ? ` (counted out of ${m.bounce_rate.window} until it has sent that many)` : ""}
                  {" "}· {limits.auto_pause ? "pauses" : "warns"} over {limits.hard_bounce_pct}%
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">No emails yet</span>
            )}
          </Row>
          <Row label="DMARC pass rate">
            {dmarcPct === null ? (
              <span className="text-muted-foreground">No reports yet</span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={dmarcPct >= limits.dmarc_pass_pct ? "good" : "bad"}>{dmarcPct.toFixed(1)}%</StatusBadge>
                <span className="text-xs text-muted-foreground">of {m.dmarc_total?.toLocaleString()} emails, last 7 days</span>
              </span>
            )}
          </Row>
          <Row label="Blacklists">
            {m.blacklist ? (
              <span className="grid gap-0.5">
                <StatusBadge tone={HEALTH[m.blacklist].tone}>
                  {m.blacklist === "FAIL" ? "Listed" : m.blacklist === "OK" ? "Not listed" : HEALTH[m.blacklist].label}
                </StatusBadge>
                {m.blacklist_detail && <span className="text-xs text-destructive">{m.blacklist_detail}</span>}
              </span>
            ) : (
              <span className="text-muted-foreground">Not checked yet</span>
            )}
          </Row>
          <Row label="Domain records">
            {m.dns ? (
              <StatusBadge tone={HEALTH[m.dns].tone}>
                {m.dns === "OK" ? "SPF, DKIM, DMARC, MX fine" : HEALTH[m.dns].label}
              </StatusBadge>
            ) : (
              <span className="text-muted-foreground">Not checked yet</span>
            )}
          </Row>
          <Row label="Latest placement">
            {!p ? (
              <span className="text-muted-foreground">No test yet</span>
            ) : p.running ? (
              <span className="text-muted-foreground">Running (started {formatRelative(p.at)})</span>
            ) : (
              <span className="flex flex-wrap items-center gap-1.5">
                {(["inbox", "promotions", "spam", "missing"] as const)
                  .filter((k) => p[k] > 0)
                  .map((k) => (
                    <StatusBadge key={k} tone={FOLDER[k.toUpperCase() as keyof typeof FOLDER].tone}>
                      {p[k]} {FOLDER[k.toUpperCase() as keyof typeof FOLDER].label.toLowerCase()}
                    </StatusBadge>
                  ))}
                <span className="text-xs text-muted-foreground">{formatRelative(p.at)}</span>
              </span>
            )}
          </Row>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ProvidersCard({ overview }: { overview: Overview }) {
  const mix = Object.fromEntries(overview.provider_mix.map((p) => [p.provider ?? "PENDING", p.leads]));
  const total = overview.provider_mix.reduce((n, p) => n + p.leads, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead providers</CardTitle>
        <CardDescription>
          Who hosts your leads&apos; email, from their domain&apos;s mail servers. Gmail and Outlook filter differently,
          so a mix that leans one way makes their placement results matter more.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total ? (
          <div className="grid gap-2">
            <ProviderMix mix={mix} />
            <span className="text-xs text-muted-foreground">{total.toLocaleString()} leads in all</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No leads yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
