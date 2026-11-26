"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import { EyeIcon, PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useRef, useState } from "react";
import { PickList } from "@/components/long-list";
import { RichEditor, textToHtml } from "@/components/rich-editor";
import { SearchableSelect } from "@/components/searchable-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, type Campaign, type Schemas, unwrap } from "@/lib/api/client";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export type FollowUp = { delay_days: number; body: string };

export type CampaignValues = {
  name: string;
  subject: string;
  body: string;
  body_format: "TEXT" | "HTML";
  follow_ups: FollowUp[];
  /** Off: the follow-ups are kept but not sent. */
  follow_ups_enabled: boolean;
  use_lead_timezone: boolean;
  group_ids: number[];
  mailbox_ids: number[];
  gap_min_seconds: number;
  gap_max_seconds: number;
  timezone: string;
  send_days: number[];
  start_hour: number;
  end_hour: number;
  /** Deals' service for leads from this campaign ("" = none), sent when a reply is handed over. */
  deals_service_key: string;
};

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const TIMEZONES = [
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Toronto",
  "UTC",
];

const DEFAULT_BODY = "Hi {{first_name|there}},\n\n\n\nBest regards,\n{{sender_name}}";
export const MAX_FOLLOW_UPS = 5;
const DEFAULT_FOLLOW_UPS: FollowUp[] = [
  {
    delay_days: 3,
    body: "Hi {{first_name|there}},\n\nJust following up on my email below. Would a quick call next week be useful?\n\n{{sender_name}}",
  },
  {
    delay_days: 4,
    body: "Hi {{first_name|there}},\n\nI don't want to fill your inbox, so this is my last note. If the timing isn't right, no problem at all.\n\n{{sender_name}}",
  },
];

/** "3 days after the first email" */
export function followUpTiming(i: number, days: number) {
  const after = i === 0 ? "the first email" : `follow-up ${i}`;
  if (days === 0) return `Right after ${after} (test copies only)`;
  return `${days} day${days === 1 ? "" : "s"} after ${after}`;
}

export function hourLabel(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export function scheduleSummary(c: Pick<CampaignValues, "send_days" | "start_hour" | "end_hour" | "timezone">) {
  const days =
    c.send_days.length === 7
      ? "Every day"
      : c.send_days.join(",") === "0,1,2,3,4"
        ? "Mon–Fri"
        : c.send_days.map((d) => DAY_LABELS[d]).join(", ");
  return `${days}, ${hourLabel(c.start_hour)}–${hourLabel(c.end_hour)} ${c.timezone.replace("_", " ")}`;
}

function initialValues(c: Campaign | undefined, groupId: number | null): CampaignValues {
  return {
    name: c?.name ?? "",
    subject: c?.subject ?? "",
    body: c?.body ?? DEFAULT_BODY,
    body_format: c?.body_format ?? "TEXT",
    follow_ups: c?.follow_ups ?? [],
    // Optional, and off for a new campaign.
    follow_ups_enabled: c ? c.follow_ups_enabled && c.follow_ups.length > 0 : false,
    use_lead_timezone: c?.use_lead_timezone ?? false,
    group_ids: c ? c.groups.map((g) => g.id) : groupId ? [groupId] : [],
    mailbox_ids: c ? c.mailboxes.map((m) => m.id) : [],
    gap_min_seconds: c?.gap_min_seconds ?? 300,
    gap_max_seconds: c?.gap_max_seconds ?? 600,
    timezone: c?.timezone ?? "Asia/Karachi",
    send_days: c?.send_days ?? [0, 1, 2, 3, 4],
    start_hour: c?.start_hour ?? 9,
    end_hour: c?.end_hour ?? 17,
    deals_service_key: c?.deals_service_key ?? "",
  };
}

const NO_SERVICE = "none";

/** Deals' services (VAPT, Odoo…), cached for an hour by the server. Hidden until Deals answers, unless a key is
 *  already saved (then it shows as text if the list can't be loaded). */
function DealsService({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const services = useQuery({
    queryKey: ["deals", "services"],
    queryFn: () => unwrap(api.GET("/api/deals/services")),
    staleTime: 60 * 60_000,
  });
  const list = services.data?.services ?? [];
  if (!list.length && !value) return null;
  return (
    <Field className="max-w-xl">
      <FieldLabel htmlFor="c-deals-service">Deals service</FieldLabel>
      {list.length ? (
        <SearchableSelect
          id="c-deals-service"
          className="w-full"
          value={value || NO_SERVICE}
          onValueChange={(v) => onChange(v === NO_SERVICE ? "" : v)}
          searchLabel="Search services"
          options={[
            { value: NO_SERVICE, label: "None", divider: true },
            ...list.map((s) => ({ value: s.key, label: s.name })),
            ...(value && !list.some((s) => s.key === value) ? [{ value, label: value }] : []),
          ]}
        />
      ) : (
        <Input id="c-deals-service" value={value} onChange={(e) => onChange(e.target.value)} maxLength={50} />
      )}
      <FieldDescription>
        Interested replies from this campaign arrive in Deals with this service, so its rules and reports work by
        service.
      </FieldDescription>
    </Field>
  );
}

/** Create or edit a campaign. `paused` locks the recipient groups (the list is fixed once sending starts). */
export function CampaignForm({
  campaign,
  initialGroupId = null,
  paused = false,
  submitLabel,
  pending,
  error,
  onSubmit,
}: {
  campaign?: Campaign;
  initialGroupId?: number | null;
  paused?: boolean;
  submitLabel: string;
  pending: boolean;
  error?: string;
  onSubmit: (values: CampaignValues) => void;
}) {
  const [v, setV] = useState<CampaignValues>(() => initialValues(campaign, initialGroupId));
  // A new campaign must choose whose clock it sends by; an existing one already has.
  const [tzChosen, setTzChosen] = useState(Boolean(campaign));
  const set = <K extends keyof CampaignValues>(key: K, value: CampaignValues[K]) => setV((s) => ({ ...s, [key]: value }));
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  // Where a clicked field is inserted: the subject, the message, or follow-up number n (0-based).
  const lastFocused = useRef<"subject" | "body" | number>("body");
  const editorRef = useRef<Editor | null>(null);
  const followUpRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  // Test copies (development, staging) may send a follow-up right after the previous email.
  const environment = useMe().data?.environment;
  const development = environment === "development" || environment === "staging";

  const groups = useQuery({ queryKey: ["groups"], queryFn: () => unwrap(api.GET("/api/groups")) });
  const mailboxes = useQuery({ queryKey: ["mailboxes"], queryFn: () => unwrap(api.GET("/api/mailboxes")) });
  const fields = useQuery({
    queryKey: ["campaign-fields", [...v.group_ids].sort()],
    queryFn: () =>
      unwrap(
        api.POST("/api/campaigns/preview", {
          body: { subject: "", body: "", body_format: "TEXT", group_ids: v.group_ids },
        }),
      ),
  });
  const preview = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/campaigns/preview", {
          body: {
            subject: v.subject,
            body: v.body,
            body_format: v.body_format,
            group_ids: v.group_ids,
            mailbox_id: v.mailbox_ids[0] ?? null,
          },
        }),
      ),
  });

  function insertVariable(name: string) {
    const token = `{{${name}}}`;
    const focus = lastFocused.current;
    if (focus === "body" && v.body_format === "HTML" && editorRef.current) {
      editorRef.current.chain().focus().insertContent(token).run();
      return;
    }
    const target =
      typeof focus === "number" ? followUpRefs.current[focus] : focus === "subject" ? subjectRef.current : bodyRef.current;
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const next = target.value.slice(0, start) + token + target.value.slice(end);
    if (typeof focus === "number") setFollowUp(focus, { body: next });
    else set(focus, next);
    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function setFollowUp(i: number, change: Partial<FollowUp>) {
    setV((s) => ({ ...s, follow_ups: s.follow_ups.map((f, n) => (n === i ? { ...f, ...change } : f)) }));
  }

  function addFollowUp() {
    setV((s) => ({
      ...s,
      follow_ups: [...s.follow_ups, DEFAULT_FOLLOW_UPS[s.follow_ups.length] ?? { delay_days: 5, body: "" }],
    }));
  }

  function switchFollowUps(on: boolean) {
    setV((s) => ({
      ...s,
      follow_ups_enabled: on,
      // Switching on with nothing written yet starts with one follow-up to edit.
      follow_ups: on && s.follow_ups.length === 0 ? [DEFAULT_FOLLOW_UPS[0]] : s.follow_ups,
    }));
  }

  function removeFollowUp(i: number) {
    setV((s) => ({ ...s, follow_ups: s.follow_ups.filter((_, n) => n !== i) }));
    lastFocused.current = "body";
  }

  function switchFormat(format: CampaignValues["body_format"]) {
    if (format === v.body_format) return;
    setV((s) => ({
      ...s,
      body_format: format,
      body:
        format === "HTML"
          ? textToHtml(s.body)
          : (editorRef.current?.getText({ blockSeparator: "\n\n" }) ?? s.body.replace(/<[^>]+>/g, "")),
    }));
    if (format === "TEXT") editorRef.current = null;
  }

  function toggle(key: "group_ids" | "mailbox_ids" | "send_days", id: number, on: boolean) {
    setV((s) => {
      const list = on ? [...new Set([...s[key], id])] : s[key].filter((x) => x !== id);
      return { ...s, [key]: key === "send_days" ? list.sort() : list };
    });
  }

  const selectedLeads = (groups.data ?? []).filter((g) => v.group_ids.includes(g.id)).reduce((n, g) => n + g.lead_count, 0);
  const selectedMailboxes = (mailboxes.data ?? []).filter((m) => v.mailbox_ids.includes(m.id));
  const avgGapMin = (v.gap_min_seconds + v.gap_max_seconds) / 120;
  const perMailboxPerDay = Math.max(0, Math.floor(((v.end_hour - v.start_hour) * 60) / Math.max(avgGapMin, 1)));
  const dailyTotal = selectedMailboxes
    .filter((m) => m.status === "ACTIVE")
    .reduce((n, m) => n + Math.min(m.daily_cap, perMailboxPerDay), 0);
  const days = dailyTotal ? Math.ceil(selectedLeads / dailyTotal) : null;

  const minDelay = development ? 0 : 1;
  const followUpError = v.follow_ups_enabled && v.follow_ups.some((f) => !Number.isInteger(f.delay_days) || f.delay_days < minDelay || f.delay_days > 60)
    ? `Wait between ${minDelay} and 60 days before each follow-up.`
    : null;
  const noReplyCheck = selectedMailboxes.filter((m) => !m.imap_host);

  const scheduleError =
    v.gap_min_seconds < MIN_GAP_MINUTES * 60
      ? `The gap must be at least ${MIN_GAP_MINUTES} minutes.`
      : v.gap_max_seconds < v.gap_min_seconds
      ? "The longest gap must be at least the shortest."
      : v.end_hour <= v.start_hour
        ? "Sending must end after it starts."
        : v.send_days.length === 0
          ? "Choose at least one day."
          : !tzChosen
            ? "Choose whose time to send in: each lead's or ours."
            : null;
  const gapWarning =
    v.gap_min_seconds >= MIN_GAP_MINUTES * 60 && v.gap_min_seconds < SAFE_GAP_MINUTES * 60
      ? `A gap under ${SAFE_GAP_MINUTES} minutes may hurt the mailbox's reputation. ${SAFE_GAP_MINUTES}–10 minutes is safer.`
      : null;
  const nightHours = v.start_hour < 7 || v.end_hour > 20;
  const hoursWarning = !nightHours
    ? null
    : v.use_lead_timezone
      ? `${hourLabel(v.start_hour)}–${hourLabel(v.end_hour)} includes night hours, so some people will get it at night their time. 09:00–17:00 is usual.`
      : `${hourLabel(v.start_hour)}–${hourLabel(v.end_hour)} includes night hours in ${v.timezone.replace("_", " ")}. 09:00–17:00 is usual.`;
  const leadCount = fields.data?.lead_count ?? 0;
  const noTimezone = fields.data?.leads_without_timezone ?? 0;

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!scheduleError && !followUpError)
          onSubmit({ ...v, follow_ups_enabled: v.follow_ups_enabled && v.follow_ups.length > 0 });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Who gets it</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field className="max-w-xl">
              <FieldLabel htmlFor="c-name">Campaign name</FieldLabel>
              <Input
                id="c-name"
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
                maxLength={200}
                placeholder="UAE logistics, November"
                required
              />
            </Field>
            <DealsService value={v.deals_service_key} onChange={(key) => set("deals_service_key", key)} />
            <div className="grid gap-6 md:grid-cols-2">
              <fieldset className="min-w-0" disabled={paused}>
                <legend className="mb-2 text-sm font-medium">Lead groups</legend>
                <div className="grid gap-2">
                {groups.isPending ? (
                  <Skeleton className="h-16" />
                ) : (
                  <PickList
                    items={groups.data ?? []}
                    selected={v.group_ids}
                    onChange={(ids) => set("group_ids", ids)}
                    text={(g) => g.name}
                    noun="groups"
                    disabled={paused}
                    empty={
                      <p className="text-sm text-muted-foreground">
                        No groups yet.{" "}
                        <Link href="/leads/import" className="text-primary underline-offset-4 hover:underline">
                          Import a CSV
                        </Link>{" "}
                        first.
                      </p>
                    }
                    render={(g, checked) => (
                      <Label key={g.id} className="flex items-center gap-2 font-normal">
                        <Checkbox checked={checked} onCheckedChange={(on) => toggle("group_ids", g.id, on === true)} disabled={paused} />
                        <span className="min-w-0 flex-1 truncate" title={g.name}>
                          {g.name}
                        </span>
                        {g.pending_count > 0 && (
                          <Link href="/leads/duplicates" className="shrink-0 text-xs text-muted-foreground underline underline-offset-4">
                            +{g.pending_count} to review
                          </Link>
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{g.lead_count.toLocaleString()}</span>
                      </Label>
                    )}
                  />
                )}
                {paused && <p className="text-xs text-muted-foreground">The recipient list is fixed once sending starts.</p>}
                </div>
              </fieldset>
              <fieldset className="min-w-0">
                <legend className="mb-2 text-sm font-medium">Send from</legend>
                <div className="grid gap-2">
                {mailboxes.isPending ? (
                  <Skeleton className="h-16" />
                ) : (
                  <PickList
                    items={mailboxes.data ?? []}
                    selected={v.mailbox_ids}
                    onChange={(ids) => set("mailbox_ids", ids)}
                    text={(m) => `${m.display_name} ${m.email}`}
                    noun="mailboxes"
                    empty={
                      <p className="text-sm text-muted-foreground">
                        No mailboxes yet.{" "}
                        <Link href="/mailboxes" className="text-primary underline-offset-4 hover:underline">
                          Add one
                        </Link>{" "}
                        first.
                      </p>
                    }
                    render={(m, checked) => (
                      <Label key={m.id} className="flex items-center gap-2 font-normal">
                        <Checkbox checked={checked} onCheckedChange={(on) => toggle("mailbox_ids", m.id, on === true)} />
                        <span className="min-w-0 flex-1 truncate" title={m.email}>
                          {m.display_name} <span className="text-muted-foreground">&lt;{m.email}&gt;</span>
                        </span>
                        {m.status !== "ACTIVE" && (
                          <Badge variant="outline" className="shrink-0 font-normal">
                            {m.status === "PAUSED" ? "Paused" : "Not connected"}
                          </Badge>
                        )}
                      </Label>
                    )}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  With several mailboxes, emails are shared between them so the list finishes sooner.
                </p>
                </div>
              </fieldset>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The email</CardTitle>
          <CardDescription>
            Click a field to insert it where the cursor is. Add a fallback after a bar:{" "}
            <code className="font-mono text-xs">{"{{first_name|there}}"}</code>. Vary wording with{" "}
            <code className="font-mono text-xs">{"{Hi|Hello}"}</code>; each email picks one at random. Only what you
            write here is sent; nothing is added.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="flex flex-wrap gap-1.5" aria-label="Insert a field">
              {(fields.data?.available_fields ?? ["email", "first_name", "last_name", "company", "country", "sender_name"]).map((f) => (
                <Button
                  key={f}
                  type="button"
                  variant="outline"
                  size="xs"
                  className="font-mono"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertVariable(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
            <Field>
              <FieldLabel htmlFor="c-subject">Subject</FieldLabel>
              <Input
                id="c-subject"
                ref={subjectRef}
                value={v.subject}
                onChange={(e) => set("subject", e.target.value)}
                onFocus={() => (lastFocused.current = "subject")}
                maxLength={998}
                placeholder="{Quick|Short} question about {{company|your team}}"
              />
            </Field>
            <Field>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FieldLabel htmlFor="c-body">Message</FieldLabel>
                <Tabs value={v.body_format} onValueChange={(f) => switchFormat(f as CampaignValues["body_format"])}>
                  <TabsList>
                    <TabsTrigger value="TEXT">Plain text</TabsTrigger>
                    <TabsTrigger value="HTML">Rich text</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {v.body_format === "HTML" ? (
                <RichEditor
                  id="c-body"
                  value={v.body}
                  onChange={(html) => set("body", html)}
                  onReady={(e) => (editorRef.current = e)}
                  onFocus={() => (lastFocused.current = "body")}
                  placeholder="Write your email…"
                />
              ) : (
                <Textarea
                  id="c-body"
                  ref={bodyRef}
                  value={v.body}
                  onChange={(e) => set("body", e.target.value)}
                  onFocus={() => (lastFocused.current = "body")}
                  rows={12}
                  className="min-h-64 leading-relaxed"
                />
              )}
              <FieldDescription>
                {v.body_format === "HTML"
                  ? "Sent as formatted email with a plain-text copy for mail apps that prefer it. Keep it simple: plain emails land in inboxes more often."
                  : "Plain text usually lands in the inbox most reliably."}
              </FieldDescription>
            </Field>
            <div className="grid gap-3">
              <Button type="button" variant="outline" className="w-fit" onClick={() => preview.mutate()} disabled={preview.isPending}>
                <EyeIcon data-icon="inline-start" /> {preview.isPending ? "Building preview…" : "Preview 3 versions"}
              </Button>
              {preview.error && <p className="text-sm text-destructive">{preview.error.message}</p>}
              {preview.data && <Preview data={preview.data} />}
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Follow-ups</CardTitle>
          <CardDescription>
            Optional. Short reminders for people who haven&apos;t replied, sent from the same mailbox as a reply in the
            same thread (&ldquo;Re: {v.subject.trim() || "your subject"}&rdquo;), during the sending hours below. They
            stop as soon as the person replies, asks to be removed, or the email bounces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Label className="flex items-start gap-2 font-normal">
              <Checkbox
                className="mt-0.5"
                checked={v.follow_ups_enabled}
                onCheckedChange={(on) => switchFollowUps(on === true)}
              />
              <span className="grid gap-0.5">
                <span className="font-medium">Send follow-ups to people who don&apos;t reply</span>
                <span className="text-xs text-muted-foreground">
                  {v.follow_ups_enabled
                    ? "Plain text only; the fields above work here too."
                    : v.follow_ups.length
                      ? `Off: only the first email is sent. Your ${v.follow_ups.length === 1 ? "follow-up is" : `${v.follow_ups.length} follow-ups are`} kept; tick to use ${v.follow_ups.length === 1 ? "it" : "them"} again.`
                      : "Off: only the first email is sent."}
                </span>
              </span>
            </Label>
            {v.follow_ups_enabled && v.follow_ups.map((f, i) => (
              <div key={i} className="grid gap-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">Follow-up {i + 1}</span>
                  <span className="text-muted-foreground">sent</span>
                  <Input
                    type="number"
                    aria-label={`Days to wait before follow-up ${i + 1}`}
                    min={minDelay}
                    max={60}
                    className="h-8 w-20"
                    value={Number.isNaN(f.delay_days) ? "" : f.delay_days}
                    onChange={(e) => setFollowUp(i, { delay_days: e.target.valueAsNumber })}
                  />
                  <span className="text-muted-foreground">
                    day{f.delay_days === 1 ? "" : "s"} after {i === 0 ? "the first email" : `follow-up ${i}`}, if no reply
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => removeFollowUp(i)}
                    aria-label={`Remove follow-up ${i + 1}`}
                  >
                    <Trash2Icon data-icon="inline-start" /> Remove
                  </Button>
                </div>
                <Textarea
                  ref={(el) => {
                    followUpRefs.current[i] = el;
                  }}
                  aria-label={`Follow-up ${i + 1} message`}
                  value={f.body}
                  onChange={(e) => setFollowUp(i, { body: e.target.value })}
                  onFocus={() => (lastFocused.current = i)}
                  rows={6}
                  className="leading-relaxed"
                  placeholder="Hi {{first_name|there}}, just following up on my email below…"
                />
                <FollowUpPreview subject={v.subject} body={f.body} groupIds={v.group_ids} mailboxId={v.mailbox_ids[0]} />
              </div>
            ))}
            {v.follow_ups_enabled && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  onClick={addFollowUp}
                  disabled={v.follow_ups.length >= MAX_FOLLOW_UPS}
                >
                  <PlusIcon data-icon="inline-start" /> Add a follow-up
                </Button>
                <span className="text-xs text-muted-foreground">
                  {v.follow_ups.length === 0
                    ? "None yet: only the first email is sent."
                    : `${v.follow_ups.length} of up to ${MAX_FOLLOW_UPS}.`}
                </span>
              </div>
            )}
            {followUpError && <p className="text-sm text-destructive">{followUpError}</p>}
            {v.follow_ups_enabled && v.follow_ups.length > 0 && noReplyCheck.length > 0 && (
              <Alert>
                <TriangleAlertIcon />
                <AlertDescription>
                  Replies to {noReplyCheck.map((m) => m.email).join(", ")} can&apos;t be noticed automatically: no
                  incoming mail (IMAP) server is set for {noReplyCheck.length === 1 ? "it" : "them"}. Add one on the{" "}
                  <Link href="/mailboxes" className="underline underline-offset-4">
                    Mailboxes
                  </Link>{" "}
                  page, or mark people as replied by hand on the campaign page. Otherwise they still get follow-ups
                  after replying.
                </AlertDescription>
              </Alert>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When it sends</CardTitle>
          <CardDescription>
            Each mailbox sends one email, then waits a random gap. Mailboxes on the same domain also stay a random
            1–3 minutes apart, each email goes at a random second, and no company gets more than 2 emails a day.
            Slow and steady keeps you out of spam folders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="flex flex-wrap items-end gap-3">
              <Field className="w-36">
                <FieldLabel htmlFor="c-gap-min">Gap, at least</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    id="c-gap-min"
                    type="number"
                    min={MIN_GAP_MINUTES}
                    max={1440}
                    value={v.gap_min_seconds / 60}
                    onChange={(e) => set("gap_min_seconds", Math.round(Number(e.target.value) * 60))}
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </Field>
              <Field className="w-36">
                <FieldLabel htmlFor="c-gap-max">at most</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    id="c-gap-max"
                    type="number"
                    min={MIN_GAP_MINUTES}
                    max={1440}
                    value={v.gap_max_seconds / 60}
                    onChange={(e) => set("gap_max_seconds", Math.round(Number(e.target.value) * 60))}
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </Field>
            </div>
            {gapWarning && <Warning>{gapWarning}</Warning>}
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium">Days</legend>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, d) => {
                  const on = v.send_days.includes(d);
                  return (
                    <Button
                      key={label}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      aria-pressed={on}
                      onClick={() => toggle("send_days", d, !on)}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-end gap-3">
              <Field className="w-28">
                <FieldLabel htmlFor="c-start">From</FieldLabel>
                <Select value={String(v.start_hour)} onValueChange={(x) => set("start_hour", Number(x))}>
                  <SelectTrigger id="c-start" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>
                        {hourLabel(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field className="w-28">
                <FieldLabel htmlFor="c-end">Until</FieldLabel>
                <Select value={String(v.end_hour)} onValueChange={(x) => set("end_hour", Number(x))}>
                  <SelectTrigger id="c-end" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {hourLabel(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field className="w-56">
                <FieldLabel htmlFor="c-tz">Timezone</FieldLabel>
                <Select value={v.timezone} onValueChange={(x) => set("timezone", x)}>
                  <SelectTrigger id="c-tz" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set([v.timezone, ...TIMEZONES])].map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {hoursWarning && <Warning>{hoursWarning}</Warning>}
            {/* Plain block fieldsets: Safari lays out a legend inside a grid/flex fieldset wrongly. */}
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium">Whose time do the days and hours follow?</legend>
              <div className="grid gap-2 md:grid-cols-2">
                <TimeChoice
                  checked={tzChosen && v.use_lead_timezone}
                  onChoose={() => {
                    set("use_lead_timezone", true);
                    setTzChosen(true);
                  }}
                  title="Each lead's local time"
                  detail={`Everyone gets it during their own working day. Leads with no known timezone use ${v.timezone.replace("_", " ")}.`}
                />
                <TimeChoice
                  checked={tzChosen && !v.use_lead_timezone}
                  onChoose={() => {
                    set("use_lead_timezone", false);
                    setTzChosen(true);
                  }}
                  title={`Our time (${v.timezone.replace("_", " ")})`}
                  detail="Everyone gets it during these hours in our timezone, wherever they are."
                />
              </div>
              {leadCount > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {noTimezone === 0
                    ? `All ${leadCount.toLocaleString()} leads have a known timezone.`
                    : `${(leadCount - noTimezone).toLocaleString()} of ${leadCount.toLocaleString()} leads have a known timezone. ${
                        v.use_lead_timezone && tzChosen
                          ? `The other ${noTimezone.toLocaleString()} will use ${v.timezone.replace("_", " ")}.`
                          : `The other ${noTimezone.toLocaleString()} have no country we could place.`
                      }`}
                </p>
              )}
            </fieldset>
            {scheduleError ? (
              <p className="text-sm text-destructive">{scheduleError}</p>
            ) : (
              <FieldDescription>
                {scheduleSummary(v)}. Each mailbox sends up to {perMailboxPerDay} a day at this pace (and never
                more than its daily cap).
                {days && selectedLeads > 0
                  ? ` About ${dailyTotal} a day across ${selectedMailboxes.length} mailbox${selectedMailboxes.length === 1 ? "" : "es"}: up to ${selectedLeads.toLocaleString()} leads take about ${days} sending day${days === 1 ? "" : "s"}.`
                  : ""}
              </FieldDescription>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !v.name.trim() || !!scheduleError || !!followUpError}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Smallest gap allowed (the server refuses less), and the gap under which we warn. */
const MIN_GAP_MINUTES = 3;
const SAFE_GAP_MINUTES = 5;

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function TimeChoice({
  checked,
  onChoose,
  title,
  detail,
}: {
  checked: boolean;
  onChoose: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
      )}
    >
      <input type="radio" name="send-timezone" className="mt-1 accent-primary" checked={checked} onChange={onChoose} />
      <span className="grid gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

function FollowUpPreview({
  subject,
  body,
  groupIds,
  mailboxId,
}: {
  subject: string;
  body: string;
  groupIds: number[];
  mailboxId: number | undefined;
}) {
  const preview = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/campaigns/preview", {
          body: {
            subject: `Re: ${subject}`,
            body,
            body_format: "TEXT",
            group_ids: groupIds,
            mailbox_id: mailboxId ?? null,
          },
        }),
      ),
  });
  return (
    <div className="grid gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => preview.mutate()}
        disabled={preview.isPending || !body.trim()}
      >
        <EyeIcon data-icon="inline-start" /> {preview.isPending ? "Building preview…" : "Preview"}
      </Button>
      {preview.error && <p className="text-sm text-destructive">{preview.error.message}</p>}
      {preview.data && <Preview data={preview.data} />}
    </div>
  );
}

function Preview({ data }: { data: Schemas["PreviewOut"] }) {
  return (
    <div className="grid gap-3">
      {data.unknown_variables.length > 0 && !data.lead_email && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            Tick a lead group above first. Without one, the preview can&apos;t fill in{" "}
            {data.unknown_variables.map((v) => (
              <code key={v} className="mx-0.5 font-mono text-xs">{`{{${v}}}`}</code>
            ))}
            . If you haven&apos;t imported your leads yet, do that on the{" "}
            <Link href="/leads/import" className="underline underline-offset-4">
              Import
            </Link>{" "}
            page.
          </AlertDescription>
        </Alert>
      )}
      {data.unknown_variables.length > 0 && data.lead_email && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            No lead in the chosen groups has{" "}
            {data.unknown_variables.map((v) => (
              <code key={v} className="mx-0.5 font-mono text-xs">{`{{${v}}}`}</code>
            ))}
            . It will be left blank unless you add a fallback.
          </AlertDescription>
        </Alert>
      )}
      <p className="text-xs text-muted-foreground">
        {data.lead_email ? `Filled in for ${data.lead_email}, picked at random.` : "No lead to fill in yet: choose a group."}
      </p>
      <div className="grid gap-3 lg:grid-cols-3">
        {data.versions.map((version, i) => (
          <div key={i} className={cn("grid content-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm")}>
            <span className="text-xs text-muted-foreground">Version {i + 1}</span>
            <p className="font-medium">{version.subject || "(no subject)"}</p>
            {version.html ? (
              <EmailHtml html={version.html} />
            ) : (
              <pre className="font-sans text-sm whitespace-pre-wrap">{version.body}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A rendered HTML email, isolated in a sandboxed frame so nothing in it can run or touch the app.
 * The server has already cleaned it; the sandbox is a second line of defence.
 */
export function EmailHtml({ html }: { html: string }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font:14px/1.55 system-ui,-apple-system,sans-serif;color:#1f2328;background:#fff}
    p{margin:0 0 .75em} ul,ol{margin:0 0 .75em;padding-left:1.25rem} a{color:#2f5bd3}
  </style></head><body>${html}</body></html>`;
  return <iframe title="Email preview" sandbox="" srcDoc={doc} className="h-72 w-full rounded-md border bg-white" />;
}
