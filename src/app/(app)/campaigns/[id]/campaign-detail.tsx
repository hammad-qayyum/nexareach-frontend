"use client";

import { nameList } from "@/components/long-list";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  DownloadIcon,
  InboxIcon,
  MessageSquareReplyIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { SearchableSelect } from "@/components/searchable-select";
import { QueryError } from "@/components/query-error";
import { StatusBadge } from "@/components/status-dot";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type Campaign, type Recipient, type RecipientStatus, type Schemas, unwrap } from "@/lib/api/client";
import { DELIVERY_SOURCE, DELIVERY_STATUS, type DeliveryStatus } from "@/lib/deliverability";
import { formatDateTime, formatRelative } from "@/lib/format";
import { canEdit, useCurrentUser } from "@/lib/session";
import { Audience } from "../audience";
import { CampaignForm, type CampaignValues, EmailHtml, followUpTiming, scheduleSummary } from "../campaign-form";
import {
  CampaignStatusBadge,
  FOLLOW_UP_STOPS,
  RECIPIENT_STATUSES,
  RecipientStatusBadge,
  recipientLabel,
  SKIP_REASONS,
} from "../campaign-status";
import { doneShare } from "../campaigns-view";

const PAGE_SIZE = 50;
const ALL = "__all__";
// A filter on top of the statuses: people who answered.
const REPLIED = "REPLIED";

type Action = "start" | "pause" | "resume" | "cancel";

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const campaignId = Number(id);
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<"start" | "cancel" | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  const campaign = useQuery({
    queryKey: ["campaigns", campaignId],
    queryFn: () => unwrap(api.GET("/api/campaigns/{campaign_id}", { params: { path: { campaign_id: campaignId } } })),
    refetchInterval: (q) => (q.state.data?.status === "RUNNING" ? 10_000 : false),
  });

  const act = useMutation({
    mutationFn: (action: Action) =>
      unwrap(
        api.POST(`/api/campaigns/{campaign_id}/${action}`, { params: { path: { campaign_id: campaignId } } }),
      ),
    onSuccess: (c, action) => {
      queryClient.setQueryData(["campaigns", campaignId], c);
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      const messages: Record<Action, string> = {
        start:
          c.status === "COMPLETED"
            ? "Nobody left to email: everyone was skipped."
            : `Started. ${c.counts.waiting.toLocaleString()} emails are queued.`,
        pause: "Paused. Nothing more is sent until you resume.",
        resume: "Sending again.",
        cancel: "Cancelled. Emails not yet sent won't go out.",
      };
      toast.success(messages[action]);
    },
    onError: (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (values: CampaignValues) => {
      const body: Partial<CampaignValues> = { ...values };
      if (campaign.data?.status === "PAUSED") delete body.group_ids;
      return unwrap(api.PATCH("/api/campaigns/{campaign_id}", { params: { path: { campaign_id: campaignId } }, body }));
    },
    onSuccess: (c) => {
      queryClient.setQueryData(["campaigns", campaignId], c);
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Saved.");
    },
  });

  if (campaign.error) return <QueryError error={campaign.error} onRetry={() => campaign.refetch()} />;
  if (campaign.isPending) return <Skeleton className="h-96" />;
  const c = campaign.data;
  const started = c.status !== "DRAFT";
  const editableNow = editable && (c.status === "DRAFT" || c.status === "PAUSED");

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/campaigns">
            <ArrowLeftIcon data-icon="inline-start" /> Campaigns
          </Link>
        </Button>
        <PageHeader
          title={c.name}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <CampaignStatusBadge status={c.status} />
              <span>{scheduleSummary(c)}</span>
            </span>
          }
          actions={
            editable && (
              <>
                {(c.status === "DRAFT" || c.status === "RUNNING" || c.status === "PAUSED") && (
                  <Button variant="outline" onClick={() => setTestOpen(true)}>
                    <SendIcon data-icon="inline-start" /> Send test
                  </Button>
                )}
                {c.status === "DRAFT" && (
                  <Button onClick={() => setConfirm("start")} disabled={act.isPending}>
                    <PlayIcon data-icon="inline-start" /> Start sending
                  </Button>
                )}
                {c.status === "RUNNING" && (
                  <Button variant="outline" onClick={() => act.mutate("pause")} disabled={act.isPending}>
                    <PauseIcon data-icon="inline-start" /> Pause
                  </Button>
                )}
                {c.status === "PAUSED" && (
                  <Button onClick={() => act.mutate("resume")} disabled={act.isPending}>
                    <PlayIcon data-icon="inline-start" /> Resume
                  </Button>
                )}
                {(c.status === "RUNNING" || c.status === "PAUSED") && (
                  <Button variant="ghost" onClick={() => setConfirm("cancel")} disabled={act.isPending}>
                    <XIcon data-icon="inline-start" /> Cancel
                  </Button>
                )}
              </>
            )
          }
        />
      </div>

      {started && <ProgressCard campaign={c} />}

      <Tabs defaultValue={started ? "recipients" : "setup"} key={started ? "started" : "draft"}>
        <TabsList>
          {started && <TabsTrigger value="recipients">Recipients</TabsTrigger>}
          <TabsTrigger value="setup">{editableNow ? "Edit" : "Email and settings"}</TabsTrigger>
          {!started && (
            <TabsTrigger value="audience">
              Leads{c.excluded_count > 0 ? ` (${c.excluded_count} left out)` : ""}
            </TabsTrigger>
          )}
        </TabsList>
        {!started && (
          <TabsContent value="audience" className="pt-4">
            <Audience campaign={c} editable={editable} />
          </TabsContent>
        )}
        {started && (
          <TabsContent value="recipients" className="pt-4">
            <Recipients campaign={c} />
          </TabsContent>
        )}
        <TabsContent value="setup" className="pt-4">
          {editableNow ? (
            <>
              {c.status === "PAUSED" && (
                <p className="mb-4 text-sm text-muted-foreground">
                  Changes apply to emails not sent yet. The recipient list stays as it is.
                </p>
              )}
              <CampaignForm
                key={`${c.id}-${c.status}`}
                campaign={c}
                paused={c.status === "PAUSED"}
                submitLabel="Save changes"
                pending={update.isPending}
                error={update.error?.message}
                onSubmit={(values) => update.mutate(values)}
              />
            </>
          ) : (
            <Summary campaign={c} />
          )}
        </TabsContent>
      </Tabs>

      <TestSendDialog campaign={c} open={testOpen} onOpenChange={setTestOpen} defaultTo={me.email} />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          {confirm === "start" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Start sending &ldquo;{c.name}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  Emails go out one at a time from{" "}
                  {c.mailboxes.length > 3 ? `${c.mailboxes.length} mailboxes` : nameList(c.mailboxes.map((m) => m.email)) || "no mailbox"}, {scheduleSummary(c)}.
                  People on the do-not-contact list, or emailed in the last 30 days, are skipped
                  {c.excluded_count > 0 ? `, and the ${c.excluded_count} you left out won't be emailed` : ""}. Save any
                  edits first, and send yourself a test if you haven&apos;t.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Not yet</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    act.mutate("start");
                    setConfirm(null);
                  }}
                >
                  Start sending
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel &ldquo;{c.name}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  The {c.counts.waiting.toLocaleString()} emails not sent yet won&apos;t go out. This can&apos;t be
                  undone; pause instead if you might continue.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    act.mutate("cancel");
                    setConfirm(null);
                  }}
                >
                  Cancel campaign
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Rough time left: each active mailbox sends up to its daily cap, or as many as its gaps allow in the sending hours. */
function finishEstimate(c: Campaign): string | null {
  const remaining = c.counts.waiting + c.counts.sending;
  const active = c.mailboxes.filter((m) => m.status === "ACTIVE");
  if (c.status !== "RUNNING" || remaining === 0 || active.length === 0) return null;
  const avgGap = (c.gap_min_seconds + c.gap_max_seconds) / 2;
  const hours = c.end_hour - c.start_hour;
  const perDay = active.reduce((n, m) => n + Math.max(1, Math.min(m.daily_cap, Math.floor((hours * 3600) / avgGap))), 0);
  const days = Math.ceil(remaining / perDay);
  return days <= 1
    ? `About ${perDay} a day, so the rest should go out within 1 sending day`
    : `About ${perDay} a day, so roughly ${days} sending days left`;
}

function ProgressCard({ campaign: c }: { campaign: Campaign }) {
  const stats: { label: string; value: number }[] = [
    { label: "Waiting", value: c.counts.waiting + c.counts.sending },
    { label: "Sent", value: c.counts.sent },
    { label: "Replied", value: c.counts.replied },
    { label: "Failed", value: c.counts.failed },
    { label: "Skipped", value: c.counts.skipped },
  ];
  const hasFollowUps = (c.follow_ups_enabled && c.follow_ups.length > 0) || c.counts.follow_ups_sent > 0;
  const firstEmailsDone = c.counts.waiting + c.counts.sending === 0;
  const next = c.mailboxes
    .filter((m) => m.status === "ACTIVE" && m.next_send_at)
    .map((m) => new Date(m.next_send_at!))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const problems = c.mailboxes.filter((m) => m.status !== "ACTIVE");
  // Sending happens in the background worker. If it stops (crash, restart, laptop asleep) nothing
  // is lost: every lead's status is in the database and sending resumes where it left off.
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async (): Promise<Schemas["HealthOut"]> => (await fetch("/api/health", { credentials: "include" })).json(),
    refetchInterval: 30_000,
    enabled: c.status === "RUNNING",
  });
  const workerDown = c.status === "RUNNING" && health.data !== undefined && !health.data.worker;

  return (
    <Card>
      <CardContent className="grid gap-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className="text-2xl font-semibold tabular-nums">{s.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="grid gap-2">
          <Progress value={doneShare(c)} className="h-2" />
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {doneShare(c)}% of {c.counts.total.toLocaleString()} done
            </span>
            {c.status === "RUNNING" && !firstEmailsDone && (
              <span>
                {next && next > new Date()
                  ? `Next email ${formatRelative(next.toISOString())}`
                  : "Next email within a minute, during sending hours"}
              </span>
            )}
            {c.finished_at && <span>Ended {formatDateTime(c.finished_at)}</span>}
          </div>
          {finishEstimate(c) && (
            <p className="text-xs text-muted-foreground">
              {finishEstimate(c)} (longer if these mailboxes also send other campaigns).
            </p>
          )}
        </div>
        {(hasFollowUps || c.counts.opted_out > 0 || c.counts.bounced > 0 || c.counts.delivered > 0) && (
          <p className="text-sm text-muted-foreground">
            {c.counts.delivered > 0 && `${c.counts.delivered.toLocaleString()} confirmed delivered. `}
            {hasFollowUps &&
              `Follow-ups: ${c.counts.follow_ups_sent.toLocaleString()} sent, ${c.counts.follow_ups_planned.toLocaleString()} ${
                c.counts.follow_ups_planned === 1 ? "person has" : "people have"
              } one still to come. `}
            {c.counts.opted_out > 0 && `${c.counts.opted_out} asked not to be emailed. `}
            {c.counts.bounced > 0 &&
              `${c.counts.bounced} bounced${c.counts.hard_bounced ? ` (${c.counts.hard_bounced} addresses don't exist, now on do-not-contact)` : ""}. `}
            {c.status === "RUNNING" &&
              firstEmailsDone &&
              c.counts.follow_ups_planned > 0 &&
              "Every first email is out; the campaign finishes after the last follow-up."}
          </p>
        )}
        {workerDown && (
          <p className="text-sm text-destructive">
            Sending is stopped: the background worker isn&apos;t running
            {health.data?.worker_last_seen ? ` (last seen ${formatRelative(health.data.worker_last_seen)})` : ""}. Nothing
            is lost. Once it&apos;s running again this campaign continues from where it stopped.
          </p>
        )}
        {problems.length > 0 && c.status === "RUNNING" && (
          <p className="text-sm text-destructive">
            Not sending from {nameList(problems.map((m) => m.email))} ({problems.some((m) => m.status === "ERROR") ? "not connected" : "paused"}). Fix it on the{" "}
            <Link href="/mailboxes" className="underline underline-offset-4">
              Mailboxes
            </Link>{" "}
            page.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function exportUrl(id: number, status: string, q: string) {
  const params = new URLSearchParams();
  if (status === REPLIED) params.set("replied", "true");
  else if (status) params.set("status", status);
  if (q) params.set("q", q);
  const query = params.toString();
  return `/api/campaigns/${id}/recipients/export${query ? `?${query}` : ""}`;
}

function Recipients({ campaign }: { campaign: Campaign }) {
  const [status, setStatus] = useState<RecipientStatus | typeof REPLIED | "">("");
  const statusParam = status === REPLIED ? undefined : status || undefined;
  const repliedParam = status === REPLIED ? true : undefined;
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const markReplied = useMutation({
    mutationFn: (recipientId: number) =>
      unwrap(
        api.POST("/api/campaigns/{campaign_id}/recipients/{recipient_id}/replied", {
          params: { path: { campaign_id: campaign.id, recipient_id: recipientId } },
        }),
      ),
    onSuccess: (r) => {
      setOpen(r);
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaign.id] });
      toast.success("Marked as replied. They won't get any more follow-ups.");
    },
    onError: (e) => toast.error(e.message),
  });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Recipient | null>(null);

  const recipients = useQuery({
    queryKey: ["campaigns", campaign.id, "recipients", status, q, page],
    queryFn: () =>
      unwrap(
        api.GET("/api/campaigns/{campaign_id}/recipients", {
          params: {
            path: { campaign_id: campaign.id },
            query: {
              status: statusParam,
              replied: repliedParam,
              q: q || undefined,
              limit: PAGE_SIZE,
              offset: (page - 1) * PAGE_SIZE,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    refetchInterval: campaign.status === "RUNNING" ? 10_000 : false,
  });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-3">
        <Select
          value={status || ALL}
          onValueChange={(v) => {
            setStatus(v === ALL ? "" : (v as RecipientStatus | typeof REPLIED));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {RECIPIENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {recipientLabel(s)}
              </SelectItem>
            ))}
            <SelectItem value={REPLIED}>Replied</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search recipients"
            className="pl-8"
            aria-label="Search recipients"
          />
        </div>
        <Button variant="outline" className="sm:ml-auto" asChild>
          {/* A plain download link: the browser sends the session cookie, and exports are logged. */}
          <a href={exportUrl(campaign.id, status, q)} download>
            <DownloadIcon data-icon="inline-start" /> Export CSV
          </a>
        </Button>
      </div>
      {recipients.error ? (
        <QueryError error={recipients.error} onRetry={() => recipients.refetch()} />
      ) : recipients.isPending ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="pr-4">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.data.items.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No recipients match.
                    </TableCell>
                  </TableRow>
                ) : (
                  recipients.data.items.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(r)}>
                      <TableCell className="pl-4">
                        <div className="grid leading-tight">
                          <span>{r.email}</span>
                          <span className="text-xs text-muted-foreground">
                            {[r.name, r.company].filter(Boolean).join(" · ") || " "}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="grid justify-items-start gap-1">
                          <RecipientStatusBadge status={r.status} />
                          {r.delivery_status && (
                            <span className="text-xs text-muted-foreground">
                              {DELIVERY_STATUS[r.delivery_status as DeliveryStatus]?.label ?? r.delivery_status}
                            </span>
                          )}
                          {followUpNote(r) && <span className="text-xs text-muted-foreground">{followUpNote(r)}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.mailbox_email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.sent_at
                          ? formatDateTime(r.sent_at)
                          : r.status === "WAITING" && r.next_attempt_at
                            ? `Retry ${formatRelative(r.next_attempt_at)}`
                            : "—"}
                      </TableCell>
                      <TableCell className="max-w-72 truncate pr-4 text-muted-foreground">
                        {r.skip_reason ? (SKIP_REASONS[r.skip_reason] ?? r.skip_reason) : (r.error ?? r.smtp_response ?? "")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={recipients.data.total} onPage={setPage} />
        </>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-2xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{open.email}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <RecipientStatusBadge status={open.status} />
                  {open.sent_at && <span>Sent {formatDateTime(open.sent_at)} from {open.mailbox_email}</span>}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 text-sm">
                {open.skip_reason && <p>{SKIP_REASONS[open.skip_reason] ?? open.skip_reason}</p>}
                {open.error && <p className="text-destructive">{open.error}</p>}
                {open.smtp_response && (
                  <p className="text-muted-foreground">
                    Server reply: <span className="font-mono text-xs">{open.smtp_response}</span>
                  </p>
                )}
                {open.delivery.length > 0 && <DeliveryTimeline events={open.delivery} />}
                {open.sent_copy_saved !== null && open.status === "SENT" && (
                  <p className="text-muted-foreground">
                    {open.sent_copy_saved
                      ? "A copy was saved in the mailbox's Sent folder."
                      : "The email was sent, but saving a copy in the Sent folder failed."}
                  </p>
                )}
                {followUpDetail(open) && <p>{followUpDetail(open)}</p>}
                {open.body_sent && (
                  <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                    <p className="font-medium">{open.subject_sent}</p>
                    {open.html_sent ? (
                      <EmailHtml html={open.html_sent} />
                    ) : (
                      <pre className="max-h-80 overflow-auto font-sans text-sm whitespace-pre-wrap">{open.body_sent}</pre>
                    )}
                  </div>
                )}
                {open.follow_ups.map((f) => (
                  <div key={f.step} className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        Follow-up {f.step}
                        {f.subject_sent ? `: ${f.subject_sent}` : ""}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {f.status === "SENT" && f.sent_at
                          ? `Sent ${formatDateTime(f.sent_at)}`
                          : f.status === "WAITING"
                            ? "Will be tried again"
                            : f.status === "SENDING"
                              ? "Sending"
                              : "Not sent"}
                      </span>
                    </div>
                    {f.error && <p className="text-destructive">{f.error}</p>}
                    {f.body_sent && (
                      <pre className="max-h-60 overflow-auto font-sans text-sm whitespace-pre-wrap">{f.body_sent}</pre>
                    )}
                  </div>
                ))}
              </div>
              {(open.last_reply_id || (canEdit(me.role) && open.status === "SENT" && !open.replied_at)) && (
                <DialogFooter>
                  {open.last_reply_id && (
                    <Button variant="outline" asChild>
                      <Link href={`/replies?open=${open.last_reply_id}`}>
                        <InboxIcon data-icon="inline-start" /> Open the conversation
                      </Link>
                    </Button>
                  )}
                  {canEdit(me.role) && open.status === "SENT" && !open.replied_at && (
                    <Button
                      variant="outline"
                      onClick={() => markReplied.mutate(open.id)}
                      disabled={markReplied.isPending}
                    >
                      <MessageSquareReplyIcon data-icon="inline-start" /> Mark as replied
                    </Button>
                  )}
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** One short line about a person's replies and follow-ups, for the recipients table. */
function followUpNote(r: Recipient): string | null {
  if (r.replied_at) return r.follow_up_stop === "opted_out" ? "Replied: asked to stop" : `Replied ${formatRelative(r.replied_at)}`;
  if (r.follow_up_stop === "bounced") return "Bounced";
  if (r.next_follow_up_at) {
    const sent = r.follow_ups_sent ? `${r.follow_ups_sent} follow-up${r.follow_ups_sent === 1 ? "" : "s"} sent · ` : "";
    return `${sent}next ${formatRelative(r.next_follow_up_at)}`;
  }
  if (r.follow_up_stop) return FOLLOW_UP_STOPS[r.follow_up_stop] ?? r.follow_up_stop;
  if (r.follow_ups_sent) return `${r.follow_ups_sent} follow-up${r.follow_ups_sent === 1 ? "" : "s"} sent`;
  return null;
}

/** The longer version, for the recipient's details. */
function followUpDetail(r: Recipient): string | null {
  const parts: string[] = [];
  if (r.replied_at) parts.push(`Replied ${formatDateTime(r.replied_at)}.`);
  if (r.follow_up_stop && r.follow_up_stop !== "replied") parts.push(`${FOLLOW_UP_STOPS[r.follow_up_stop] ?? r.follow_up_stop}.`);
  if (r.next_follow_up_at) parts.push(`Follow-up ${r.follow_ups_sent + 1} is due ${formatRelative(r.next_follow_up_at)}.`);
  else if (r.replied_at || r.follow_up_stop) parts.push("No more follow-ups.");
  return parts.length ? parts.join(" ") : null;
}

function Summary({ campaign: c }: { campaign: Campaign }) {
  const rows: [string, string][] = [
    ["Groups", nameList(c.groups.map((g) => g.name), 5) || "—"],
    ["Sent from", c.mailboxes.length > 5 ? `${c.mailboxes.length} mailboxes: ${nameList(c.mailboxes.map((m) => m.email), 5)}` : c.mailboxes.map((m) => `${m.display_name} <${m.email}>`).join(", ") || "—"],
    ["When", scheduleSummary(c)],
    ["Gap between emails", `${c.gap_min_seconds / 60}–${c.gap_max_seconds / 60} minutes per mailbox`],
    ["Local time", c.use_lead_timezone ? "Each lead's own timezone" : "The campaign's timezone for everyone"],
    ["Format", c.body_format === "HTML" ? "Rich text (with a plain-text copy)" : "Plain text"],
    [
      "Follow-ups",
      c.follow_ups_enabled && c.follow_ups.length
        ? c.follow_ups.map((f, i) => followUpTiming(i, f.delay_days)).join("; ")
        : "Off",
    ],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Email template</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p className="font-medium">{c.subject}</p>
          {c.body_format === "HTML" ? (
            <div className="email-html text-muted-foreground" dangerouslySetInnerHTML={{ __html: c.body }} />
          ) : (
            <pre className="font-sans whitespace-pre-wrap text-muted-foreground">{c.body}</pre>
          )}
          {c.follow_ups_enabled && c.follow_ups.map((f, i) => (
            <div key={i} className="mt-3 grid gap-1 border-t pt-3">
              <p className="font-medium">
                Follow-up {i + 1} <span className="font-normal text-muted-foreground">({followUpTiming(i, f.delay_days)})</span>
              </p>
              <pre className="font-sans whitespace-pre-wrap text-muted-foreground">{f.body}</pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TestSendDialog({
  campaign,
  open,
  onOpenChange,
  defaultTo,
}: {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo: string;
}) {
  const [to, setTo] = useState(defaultTo);
  const [mailboxId, setMailboxId] = useState<string>("");
  const [withFollowUps, setWithFollowUps] = useState(false);
  const send = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/campaigns/{campaign_id}/test-send", {
          params: { path: { campaign_id: campaign.id } },
          body: {
            to,
            mailbox_id: mailboxId ? Number(mailboxId) : null,
            include_follow_ups: withFollowUps && campaign.follow_ups_enabled && campaign.follow_ups.length > 0,
          },
        }),
      ),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success(`Test sent to ${to}. ${r.detail}`);
        onOpenChange(false);
      }
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) send.reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <form
          className="grid gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Send a test</DialogTitle>
            <DialogDescription>
              Sends the saved email, filled in for a random lead, with &ldquo;[Test]&rdquo; in front of the subject.
              Save any edits first.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="test-to">Send to</FieldLabel>
              <Input id="test-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
            </Field>
            {campaign.mailboxes.length > 1 && (
              <Field>
                <FieldLabel htmlFor="test-from">Send from</FieldLabel>
                <SearchableSelect
                  id="test-from"
                  className="w-full"
                  searchLabel="Search mailboxes"
                  value={mailboxId || String(campaign.mailboxes[0].id)}
                  onValueChange={setMailboxId}
                  options={campaign.mailboxes.map((m) => ({ value: String(m.id), label: m.email }))}
                />
              </Field>
            )}
            {campaign.follow_ups_enabled && campaign.follow_ups.length > 0 && (
              <Label className="flex items-start gap-2 font-normal">
                <Checkbox className="mt-0.5" checked={withFollowUps} onCheckedChange={(on) => setWithFollowUps(on === true)} />
                <span className="grid gap-0.5">
                  <span>Also send the {campaign.follow_ups.length === 1 ? "follow-up" : `${campaign.follow_ups.length} follow-ups`}</span>
                  <span className="text-xs text-muted-foreground">
                    Straight away, as replies in the same thread, so you can see how the conversation looks.
                  </span>
                </span>
              </Label>
            )}
            {campaign.mailboxes.length === 0 && (
              <p className="text-sm text-destructive">Choose a mailbox in the campaign settings first.</p>
            )}
            {(send.error || (send.data && !send.data.ok)) && (
              <p className="text-sm text-destructive">{send.error?.message ?? send.data?.detail}</p>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" disabled={send.isPending || campaign.mailboxes.length === 0}>
              {send.isPending ? "Sending…" : "Send test"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


/** What happened after the email left: the send, cPanel's delivery log, bounce emails. */
function DeliveryTimeline({ events }: { events: Schemas["DeliveryEventOut"][] }) {
  return (
    <div className="grid gap-1.5">
      <p className="font-medium">Delivery</p>
      <ol className="grid gap-1.5 border-l pl-3">
        {events.map((e) => (
          <li key={e.id} className="grid gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={DELIVERY_STATUS[e.status].tone}>{DELIVERY_STATUS[e.status].label}</StatusBadge>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(e.occurred_at)} · {DELIVERY_SOURCE[e.source]}
                {e.remote_host ? ` · ${e.remote_host}` : ""}
              </span>
            </span>
            {e.response && <span className="font-mono text-xs break-words text-muted-foreground">{e.response}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
