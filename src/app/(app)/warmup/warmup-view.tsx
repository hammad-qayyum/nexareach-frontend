"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontalIcon, PlayIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Limited, nameList } from "@/components/long-list";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { StatusBadge, type Tone } from "@/components/status-dot";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { pauseReason } from "@/lib/deliverability";
import { formatDate, formatRelative } from "@/lib/format";
import { canEdit, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { HelperDialog, PROVIDER_LABEL } from "./helper-dialog";

type Overview = Schemas["OverviewOut"];
type MailboxWarmup = Schemas["MailboxWarmup"];
type Helper = Schemas["HelperOut"];

export const WARMUP_KEY = ["warmup"] as const;
const HELPERS_KEY = ["warmup", "helpers"] as const;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function scheduleText(s: Schemas["ScheduleIO"]) {
  const days =
    s.days.join(",") === "0,1,2,3,4"
      ? "Mon–Fri"
      : s.days.length === 7
        ? "every day"
        : s.days.map((d) => DAY_NAMES[d]).join(", ");
  const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return `${days}, ${hour(s.start_hour)}–${hour(s.end_hour)} ${s.timezone.replace("_", " ")}`;
}

function rateTone(rate: number | null | undefined): Tone {
  if (rate === null || rate === undefined) return "muted";
  return rate >= 80 ? "good" : rate >= 50 ? "warn" : "bad";
}

export function WarmupView() {
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const [dialog, setDialog] = useState<Helper | "new" | null>(null);
  const overview = useQuery({
    queryKey: WARMUP_KEY,
    queryFn: () => unwrap(api.GET("/api/warmup")),
    refetchInterval: 60_000,
  });
  const helpers = useQuery({ queryKey: HELPERS_KEY, queryFn: () => unwrap(api.GET("/api/warmup/helpers")) });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Warm-up"
        description="Builds trust in your mailboxes: new ones start slowly, and warm-up emails to your helper accounts get opened, rescued from spam and answered."
        actions={
          editable && (
            <Button onClick={() => setDialog("new")}>
              <PlusIcon data-icon="inline-start" /> Add helper account
            </Button>
          )
        }
      />
      {overview.error ? (
        <QueryError error={overview.error} onRetry={() => overview.refetch()} />
      ) : overview.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <Warnings overview={overview.data} editable={editable} />
          <MailboxesCard overview={overview.data} editable={editable} />
        </>
      )}
      {helpers.error ? (
        <QueryError error={helpers.error} onRetry={() => helpers.refetch()} />
      ) : helpers.isPending ? (
        <Skeleton className="h-48" />
      ) : (
        <HelpersCard helpers={helpers.data} editable={editable} onEdit={setDialog} onAdd={() => setDialog("new")} />
      )}
      {editable && <HelperDialog helper={dialog} onOpenChange={(open) => !open && setDialog(null)} />}
    </div>
  );
}

function Warnings({ overview, editable }: { overview: Overview; editable: boolean }) {
  const queryClient = useQueryClient();
  const resume = useMutation({
    mutationFn: (mailboxId: number) =>
      unwrap(api.POST("/api/mailboxes/{mailbox_id}/resume-campaigns", { params: { path: { mailbox_id: mailboxId } } })),
    onSuccess: (m) => {
      queryClient.invalidateQueries({ queryKey: WARMUP_KEY });
      queryClient.invalidateQueries({ queryKey: ["mailboxes"] });
      toast.success(`Campaign emails from ${m.email} are going out again.`);
    },
    onError: (e) => toast.error(e.message),
  });
  const paused = overview.mailboxes.filter((m) => m.campaigns_paused_at);
  const low = overview.mailboxes.filter((m) => m.low_rate && !m.campaigns_paused_at);
  const usingWarmup = overview.mailboxes.some((m) => m.warmup_enabled);
  if (!paused.length && !low.length && !overview.helpers_with_errors && !(usingWarmup && !overview.active_helpers)) return null;
  return (
    <div className="grid gap-3">
      {usingWarmup && overview.active_helpers === 0 && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>
            Warm-up is on but there is no working helper account, so no warm-up emails go out. Add one below.
          </AlertDescription>
        </Alert>
      )}
      {overview.helpers_with_errors > 0 && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            {overview.helpers_with_errors === 1 ? "A helper account can't" : `${overview.helpers_with_errors} helper accounts can't`}{" "}
            sign in. Warm-up carries on with the others; fix or replace {overview.helpers_with_errors === 1 ? "it" : "them"}{" "}
            below. (Free accounts sometimes get locked by Google or Microsoft.)
          </AlertDescription>
        </Alert>
      )}
      {paused.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription className="grid gap-2">
            <span>
              {paused.length === 1 ? "Campaign emails from one mailbox are paused" : `Campaign emails from ${paused.length} mailboxes are paused`}.
              Warm-up carries on. Resume once the problem is fixed, or if you know why it happened (details on the{" "}
              <Link href="/deliverability" className="underline underline-offset-4">
                Deliverability
              </Link>{" "}
              page).
            </span>
            <Limited items={paused} limit={3} noun="more" buttonClassName="-ml-2 h-7 text-destructive">
              {(shown) => (
                <ul className="grid gap-1.5">
                  {shown.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="min-w-0 flex-1">
                        <strong>{m.email}</strong>: {pauseReason(m.campaigns_paused_reason)}
                      </span>
                      {editable && (
                        <Button size="sm" variant="outline" onClick={() => resume.mutate(m.id)} disabled={resume.isPending}>
                          <PlayIcon data-icon="inline-start" /> Resume campaign emails
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Limited>
          </AlertDescription>
        </Alert>
      )}
      {low.length > 0 && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            {low.length === 1
              ? `${low[0].email}'s warm-up inbox rate has been under 50% for 3 days.`
              : `${low.length} mailboxes have had a warm-up inbox rate under 50% for 3 days: ${nameList(low.map((m) => m.email))}.`}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function MailboxesCard({ overview, editable }: { overview: Overview; editable: boolean }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) =>
      unwrap(
        api.PATCH("/api/mailboxes/{mailbox_id}", { params: { path: { mailbox_id: id } }, body: { warmup_enabled: on } }),
      ),
    onSuccess: (m) => {
      queryClient.invalidateQueries({ queryKey: WARMUP_KEY });
      queryClient.invalidateQueries({ queryKey: ["mailboxes"] });
      toast.success(m.warmup_enabled ? `Warm-up is on for ${m.email}.` : `Warm-up is off for ${m.email}.`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mailboxes</CardTitle>
        <CardDescription>
          Warm-up emails go out {scheduleText(overview.schedule)} (
          <Link href="/settings" className="underline underline-offset-4">
            change
          </Link>
          ), 5–10 per mailbox per day, inside its daily limit. The inbox rate is the share that reached the helper&apos;s
          inbox rather than spam, over the last 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {overview.mailboxes.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">
            No mailboxes yet.{" "}
            <Link href="/mailboxes" className="underline underline-offset-4">
              Add one
            </Link>{" "}
            first.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Mailbox</TableHead>
                <TableHead>Warm-up</TableHead>
                <TableHead>Today</TableHead>
                <TableHead>Inbox rate</TableHead>
                <TableHead className="pr-6">Last 14 days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.mailboxes.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-6">
                    <div className="grid leading-tight">
                      <span className="font-medium">{m.display_name}</span>
                      <span className="text-xs text-muted-foreground">{m.email}</span>
                      {m.campaigns_paused_at && (
                        <span className="text-xs font-medium text-destructive">Campaign emails paused</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={m.warmup_enabled}
                        disabled={!editable || toggle.isPending}
                        onCheckedChange={(on) => toggle.mutate({ id: m.id, on: on === true })}
                        aria-label={`Warm-up for ${m.email}`}
                      />
                      {m.warmup_enabled ? "On" : "Off"}
                    </label>
                    {m.warmup_enabled && !m.has_imap && (
                      <span className="mt-1 block max-w-44 text-xs text-muted-foreground">
                        No IMAP server: helper replies stay in its inbox.
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {m.warmup_enabled ? (
                      <span className="tabular-nums">
                        {m.sent_today} of {m.planned_today} warm-up
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No warm-up</span>
                    )}
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      Limit {m.daily_limit_today}/{m.daily_cap}
                      {m.ramp_day ? ` · ramp-up day ${m.ramp_day}` : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    <RateCell mailbox={m} />
                  </TableCell>
                  <TableCell className="pr-6">
                    <Trend days={m.trend} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RateCell({ mailbox: m }: { mailbox: MailboxWarmup }) {
  if (m.rate === null || m.rate === undefined) {
    return <span className="text-sm text-muted-foreground">{m.warmup_enabled ? "No results yet" : "—"}</span>;
  }
  return (
    <div className="grid gap-1">
      <StatusBadge tone={rateTone(m.rate)}>{m.rate}% inbox</StatusBadge>
      <span className="text-xs text-muted-foreground">
        {m.rates.map((r) => `${PROVIDER_LABEL[r.provider]} ${r.rate ?? 0}%`).join(" · ")}
      </span>
    </div>
  );
}

/** One small bar per day: its height is the inbox rate; days without results show as a dash. */
function Trend({ days }: { days: Schemas["DayRate"][] }) {
  return (
    <div className="flex h-8 items-end gap-0.5" role="img" aria-label="Inbox rate over the last 14 days">
      {days.map((d) => {
        const rate = d.total ? d.inbox / d.total : null;
        return (
          <span
            key={d.date}
            title={d.total ? `${formatDate(d.date)}: ${d.inbox} of ${d.total} in the inbox` : `${formatDate(d.date)}: no results`}
            className={cn(
              "w-1.5 rounded-sm",
              rate === null ? "h-0.5 bg-muted-foreground/30" : rate >= 0.8 ? "bg-success" : rate >= 0.5 ? "bg-warning" : "bg-destructive",
            )}
            style={rate === null ? undefined : { height: `${Math.max(12, rate * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

const HELPER_STATUS: Record<Helper["status"], { label: string; tone: Tone }> = {
  ACTIVE: { label: "Working", tone: "good" },
  PAUSED: { label: "Paused", tone: "muted" },
  ERROR: { label: "Can't sign in", tone: "bad" },
};

function HelpersCard({
  helpers,
  editable,
  onEdit,
  onAdd,
}: {
  helpers: Helper[];
  editable: boolean;
  onEdit: (h: Helper) => void;
  onAdd: () => void;
}) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<Helper | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: WARMUP_KEY });
  const test = useMutation({
    mutationFn: (h: Helper) => unwrap(api.POST("/api/warmup/helpers/{helper_id}/test", { params: { path: { helper_id: h.id } } })),
    onSuccess: (h) => {
      refresh();
      if (h.connection?.ok) toast.success(h.connection.detail);
      else toast.error(h.connection?.detail ?? "The test failed.");
    },
    onError: (e) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: ({ h, status }: { h: Helper; status: "ACTIVE" | "PAUSED" }) =>
      unwrap(api.PATCH("/api/warmup/helpers/{helper_id}", { params: { path: { helper_id: h.id } }, body: { status } })),
    onSuccess: (h) => {
      refresh();
      if (h.status === "PAUSED") toast.success(`${h.email} is paused.`);
      else if (h.status === "ACTIVE") toast.success(`${h.email} is working again.`);
      else toast.error(h.connection?.detail ?? "It still can't sign in.");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (h: Helper) => unwrap(api.DELETE("/api/warmup/helpers/{helper_id}", { params: { path: { helper_id: h.id } } })),
    onSuccess: () => {
      refresh();
      toast.success("Helper account removed.");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Helper accounts</CardTitle>
        <CardDescription>
          Inboxes you own (Gmail, Outlook, Yahoo or any other) that receive warm-up emails. The app signs in to them to
          rescue emails from spam, open, star and answer them. Aim for 5 or more, from different providers.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {helpers.length === 0 ? (
          <div className="grid justify-items-center gap-3 px-6 py-6 text-center text-sm text-muted-foreground">
            No helper accounts yet.
            {editable && (
              <Button variant="outline" onClick={onAdd}>
                <PlusIcon data-icon="inline-start" /> Add helper account
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Account</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received (7 days)</TableHead>
                <TableHead>Last checked</TableHead>
                <TableHead className="w-12 pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {helpers.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="pl-6">
                    <div className="grid leading-tight">
                      <span className="font-medium">{h.display_name}</span>
                      <span className="text-xs text-muted-foreground">{h.email}</span>
                      {h.status === "ERROR" && h.last_error && (
                        <span className="max-w-80 text-xs text-destructive">{h.last_error}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {PROVIDER_LABEL[h.provider]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={HELPER_STATUS[h.status].tone}>{HELPER_STATUS[h.status].label}</StatusBadge>
                  </TableCell>
                  <TableCell className="tabular-nums">{h.received_7d}</TableCell>
                  <TableCell className="text-muted-foreground">{h.last_checked_at ? formatRelative(h.last_checked_at) : "—"}</TableCell>
                  <TableCell className="pr-6">
                    {editable && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${h.email}`}>
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => test.mutate(h)}>Test connection</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onEdit(h)}>Edit</DropdownMenuItem>
                          {h.status === "PAUSED" || h.status === "ERROR" ? (
                            <DropdownMenuItem onSelect={() => setStatus.mutate({ h, status: "ACTIVE" })}>
                              {h.status === "PAUSED" ? "Resume" : "Try again"}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => setStatus.mutate({ h, status: "PAUSED" })}>Pause</DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(h)}>
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops receiving warm-up emails. Its past results stay in the inbox rates. The account itself isn&apos;t
              touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removing) remove.mutate(removing);
                setRemoving(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
