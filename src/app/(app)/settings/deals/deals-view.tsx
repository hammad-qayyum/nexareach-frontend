"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, CheckCircle2Icon, RefreshCwIcon, TriangleAlertIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { ALERT_COUNT_KEY } from "@/lib/deliverability";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { isAdmin, useCurrentUser } from "@/lib/session";

const SETTINGS_KEY = ["settings", "deals"] as const;
const STATUS_KEY = ["deals", "status"] as const;
type Result = { ok: boolean; detail: string };

const HANDOVER_STATUS: Record<string, string> = {
  queued: "waiting to go",
  created: "new leads",
  existing: "already in Deals",
  blocked: "opted out in Deals",
  failed: "failed",
};

/** Settings → Deals (admins only): the connection to the Deals CRM and the do-not-email list. */
export function DealsView() {
  const me = useCurrentUser();
  if (!isAdmin(me.role)) return <Forbidden />;
  return <DealsSettings />;
}

function DealsSettings() {
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: () => unwrap(api.GET("/api/settings/deals")) });
  const status = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => unwrap(api.GET("/api/deals/status")),
    refetchInterval: 60_000,
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/settings">
            <ArrowLeftIcon /> Settings
          </Link>
        </Button>
        <PageHeader
          title="Deals"
          description="The connection to the Deals CRM. NexaReach calls Deals; Deals never calls NexaReach."
        />
      </div>
      {status.data && <StatusCard status={status.data} secretSet={settings.data?.secret_set ?? false} />}
      {settings.error ? (
        <QueryError error={settings.error} onRetry={() => settings.refetch()} />
      ) : settings.isPending ? (
        <Skeleton className="h-96 max-w-2xl" />
      ) : (
        <ConnectionForm key={JSON.stringify(settings.data)} initial={settings.data} />
      )}
    </div>
  );
}

function ResultLine({ result }: { result: Result | null }) {
  if (!result) return null;
  const Icon = result.ok ? CheckCircle2Icon : XCircleIcon;
  return (
    <p className={`flex items-start gap-2 text-sm ${result.ok ? "text-success" : "text-destructive"}`}>
      <Icon className="mt-0.5 size-4 shrink-0" /> {result.detail}
    </p>
  );
}

function When({ at }: { at: string | null | undefined }) {
  if (!at) return <span className="text-muted-foreground">Never</span>;
  return <span title={formatDateTime(at)}>{formatRelative(at)}</span>;
}

function StatusCard({ status: s, secretSet }: { status: Schemas["DealsStatusOut"]; secretSet: boolean }) {
  const queryClient = useQueryClient();
  const [synced, setSynced] = useState<Result | null>(null);
  const sync = useMutation({
    mutationFn: () => unwrap(api.POST("/api/deals/blocklist/sync")),
    onSuccess: (r) => {
      setSynced(r);
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      queryClient.invalidateQueries({ queryKey: ALERT_COUNT_KEY });
    },
    onError: (e) => toast.error(e.message),
  });
  const b = s.blocklist;

  return (
    <div className="grid max-w-2xl gap-4">
      {s.test_mode && (
        <Alert>
          <AlertTitle>Test copy</AlertTitle>
          <AlertDescription>
            This copy isn&apos;t production, so every call to Deals is a test call: Deals checks it and answers, but
            saves nothing.
          </AlertDescription>
        </Alert>
      )}
      {s.campaigns_held && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Campaign emails are on hold</AlertTitle>
          <AlertDescription>
            The copy of the Deals do-not-email list is out of date, so no campaign or follow-up email goes out.
            Warm-up carries on. Sending starts again by itself after the next good sync.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Do-not-email list</CardTitle>
          <CardDescription>
            People NexaReach must never email: everyone in Deals, clients, Lost leads for 6 months, Meta ad leads and
            everyone who opted out. Fetched every 10 minutes, and in full once a day.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">People on the list</dt>
            <dd className="tabular-nums">{b.active_blocks.toLocaleString()}</dd>
            <dt className="text-muted-foreground">Last sync</dt>
            <dd>
              <When at={b.last_success_at} />
            </dd>
            <dt className="text-muted-foreground">Last full fetch</dt>
            <dd>
              <When at={b.last_full_at} />
            </dd>
            {b.last_error && (
              <>
                <dt className="text-muted-foreground">Last error</dt>
                <dd className="text-destructive">
                  {b.last_error} {b.last_error_at && <span className="text-muted-foreground">({formatRelative(b.last_error_at)})</span>}
                </dd>
              </>
            )}
          </dl>
          <ResultLine result={synced} />
        </CardContent>
        <CardContent className="grid gap-2 border-t pt-4">
          <p className="text-sm font-medium">Opt-outs shared with Deals</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Waiting to be sent</dt>
            <dd className="tabular-nums">{s.optouts.waiting.toLocaleString()}</dd>
            <dt className="text-muted-foreground">Last sent</dt>
            <dd>
              <When at={s.optouts.last_success_at} />
            </dd>
            {s.optouts.failed_batches > 0 && (
              <>
                <dt className="text-muted-foreground">Refused by Deals</dt>
                <dd className="text-destructive">{s.optouts.failed_batches} batch(es); see the activity log</dd>
              </>
            )}
            {s.optouts.last_error && (
              <>
                <dt className="text-muted-foreground">Last error</dt>
                <dd className="text-destructive">{s.optouts.last_error}</dd>
              </>
            )}
          </dl>
        </CardContent>
        <CardContent className="grid gap-2 border-t pt-4">
          <p className="text-sm font-medium">Handovers and results</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Handovers</dt>
            <dd>
              {Object.keys(s.handovers).length === 0
                ? "None yet"
                : Object.entries(s.handovers)
                    .map(([status, n]) => `${n} ${HANDOVER_STATUS[status] ?? status}`)
                    .join(" · ")}
            </dd>
            <dt className="text-muted-foreground">Results last collected</dt>
            <dd>
              <When at={s.events.last_success_at} />
            </dd>
            {s.events.last_error && (
              <>
                <dt className="text-muted-foreground">Results error</dt>
                <dd className="text-destructive">{s.events.last_error}</dd>
              </>
            )}
          </dl>
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="outline" onClick={() => sync.mutate()} disabled={!secretSet || sync.isPending}>
            <RefreshCwIcon className={sync.isPending ? "animate-spin" : undefined} />
            {sync.isPending ? "Syncing…" : "Sync now"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function ConnectionForm({ initial }: { initial: Schemas["DealsSettingsOut"] }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(initial.url);
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(initial.blocklist_enabled);
  const [stale, setStale] = useState(String(initial.stale_minutes));
  const [optouts, setOptouts] = useState(initial.optouts_enabled);
  const [handover, setHandover] = useState(initial.handover_enabled);
  const [events, setEvents] = useState(initial.events_enabled);
  const [tested, setTested] = useState<Result | null>(null);
  const staleNumber = Number(stale);
  const staleError = !Number.isInteger(staleNumber) || staleNumber < 5 || staleNumber > 1440;

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PUT("/api/settings/deals", {
          body: {
            url,
            secret: secret || null,
            blocklist_enabled: enabled,
            stale_minutes: staleNumber,
            optouts_enabled: optouts,
            handover_enabled: handover,
            events_enabled: events,
          },
        }),
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_KEY, data);
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      queryClient.invalidateQueries({ queryKey: ALERT_COUNT_KEY });
      toast.success(
        enabled && !initial.blocklist_enabled
          ? "Saved. The do-not-email list is being fetched now."
          : "Deals settings saved.",
      );
    },
    onError: (e) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: () => unwrap(api.POST("/api/settings/deals/test")),
    onSuccess: setTested,
    onError: (e) => toast.error(e.message),
  });
  const unchanged =
    url === initial.url &&
    !secret &&
    enabled === initial.blocklist_enabled &&
    stale === String(initial.stale_minutes) &&
    optouts === initial.optouts_enabled &&
    handover === initial.handover_enabled &&
    events === initial.events_enabled;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Connection</CardTitle>
        <CardDescription>
          The address of Deals and the shared secret every call is signed with. The owner hands the secret over in
          person or through a password manager, never by chat or email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="deals-url">Deals address</FieldLabel>
            <Input id="deals-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://deals.fastnexa.com" />
          </Field>
          <Field>
            <FieldLabel htmlFor="deals-secret">Shared secret</FieldLabel>
            <Input
              id="deals-secret"
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={
                initial.secret_set
                  ? `Set${initial.secret_set_at ? ` on ${formatDate(initial.secret_set_at)}` : ""} (type a new one to replace it)`
                  : "Not set"
              }
            />
            <FieldDescription>Stored encrypted and never shown again. Leave it empty to keep the saved one.</FieldDescription>
          </Field>
          <Label className="flex items-start gap-3 font-normal">
            <Checkbox className="mt-0.5" checked={enabled} onCheckedChange={(on) => setEnabled(on === true)} />
            <span className="grid gap-1">
              <span className="font-medium">Check the Deals do-not-email list</span>
              <span className="text-sm text-muted-foreground">
                At import, at campaign Start and before every email. While it&apos;s on and the list can&apos;t be
                fetched, campaign emails wait.
              </span>
            </span>
          </Label>
          <Field>
            <FieldLabel htmlFor="deals-stale">Hold campaign emails when the list is older than</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="deals-stale"
                className="w-24"
                inputMode="numeric"
                value={stale}
                onChange={(e) => setStale(e.target.value.replace(/\D/g, ""))}
                aria-invalid={staleError}
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
            <FieldDescription className={staleError ? "text-destructive" : undefined}>
              {staleError ? "Between 5 and 1,440 minutes." : "The list is fetched every 10 minutes. 30 is a safe choice."}
            </FieldDescription>
          </Field>
          <Label className="flex items-start gap-3 font-normal">
            <Checkbox className="mt-0.5" checked={optouts} onCheckedChange={(on) => setOptouts(on === true)} />
            <span className="grid gap-1">
              <span className="font-medium">Share opt-outs with Deals</span>
              <span className="text-sm text-muted-foreground">
                Everyone NexaReach puts on do-not-contact (asked to stop, hard bounce, spam complaint, added by hand)
                is sent to Deals within a few minutes, so Deals and CyberBrief stop too. The first time, the whole
                current list goes. Forgotten people are sent as a hash only.
              </span>
            </span>
          </Label>
          <Label className="flex items-start gap-3 font-normal">
            <Checkbox className="mt-0.5" checked={handover} onCheckedChange={(on) => setHandover(on === true)} />
            <span className="grid gap-1">
              <span className="font-medium">Hand interested replies to Deals</span>
              <span className="text-sm text-muted-foreground">
                Replies scoring at or above the auto line go to Deals as leads at once; Send to Deals works on the
                Replies page. Off: they wait on the Needs review list. After a handover NexaReach stops every
                follow-up to that person.
              </span>
            </span>
          </Label>
          <Label className="flex items-start gap-3 font-normal">
            <Checkbox className="mt-0.5" checked={events} onCheckedChange={(on) => setEvents(on === true)} />
            <span className="grid gap-1">
              <span className="font-medium">Collect results from Deals</span>
              <span className="text-sm text-muted-foreground">
                Every 5 minutes: each handed-over lead&apos;s stage, the Won value and the Lost reason, for the
                reports.
              </span>
            </span>
          </Label>
          <ResultLine result={tested} />
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" onClick={() => test.mutate()} disabled={!initial.secret_set || test.isPending}>
          {test.isPending ? "Testing…" : "Test connection"}
        </Button>
        <Button onClick={() => save.mutate()} disabled={unchanged || staleError || save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </CardFooter>
    </Card>
  );
}
