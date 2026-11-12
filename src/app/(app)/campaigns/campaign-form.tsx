"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import { EyeIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { RichEditor, textToHtml } from "@/components/rich-editor";
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
import { cn } from "@/lib/utils";

export type CampaignValues = {
  name: string;
  subject: string;
  body: string;
  body_format: "TEXT" | "HTML";
  use_lead_timezone: boolean;
  group_ids: number[];
  mailbox_ids: number[];
  gap_min_seconds: number;
  gap_max_seconds: number;
  timezone: string;
  send_days: number[];
  start_hour: number;
  end_hour: number;
};

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TIMEZONES = [
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
    use_lead_timezone: c?.use_lead_timezone ?? false,
    group_ids: c ? c.groups.map((g) => g.id) : groupId ? [groupId] : [],
    mailbox_ids: c ? c.mailboxes.map((m) => m.id) : [],
    gap_min_seconds: c?.gap_min_seconds ?? 300,
    gap_max_seconds: c?.gap_max_seconds ?? 600,
    timezone: c?.timezone ?? "Asia/Karachi",
    send_days: c?.send_days ?? [0, 1, 2, 3, 4],
    start_hour: c?.start_hour ?? 9,
    end_hour: c?.end_hour ?? 17,
  };
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
  const set = <K extends keyof CampaignValues>(key: K, value: CampaignValues[K]) => setV((s) => ({ ...s, [key]: value }));
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");
  const editorRef = useRef<Editor | null>(null);

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
    select: (d) => d.available_fields,
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
    if (lastFocused.current === "body" && v.body_format === "HTML" && editorRef.current) {
      editorRef.current.chain().focus().insertContent(token).run();
      return;
    }
    const target = lastFocused.current === "subject" ? subjectRef.current : bodyRef.current;
    const key = lastFocused.current;
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const next = target.value.slice(0, start) + token + target.value.slice(end);
    set(key, next);
    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start + token.length, start + token.length);
    });
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

  const scheduleError =
    v.gap_max_seconds < v.gap_min_seconds
      ? "The longest gap must be at least the shortest."
      : v.end_hour <= v.start_hour
        ? "Sending must end after it starts."
        : v.send_days.length === 0
          ? "Choose at least one day."
          : null;

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!scheduleError) onSubmit(v);
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
            <div className="grid gap-6 md:grid-cols-2">
              <fieldset className="grid content-start gap-2" disabled={paused}>
                <legend className="mb-2 text-sm font-medium">Lead groups</legend>
                {groups.isPending ? (
                  <Skeleton className="h-16" />
                ) : groups.data?.length ? (
                  groups.data.map((g) => (
                    <Label key={g.id} className="flex items-center gap-2 font-normal">
                      <Checkbox
                        checked={v.group_ids.includes(g.id)}
                        onCheckedChange={(on) => toggle("group_ids", g.id, on === true)}
                        disabled={paused}
                      />
                      <span className="flex-1">{g.name}</span>
                      {g.pending_count > 0 && (
                        <Link href="/leads/duplicates" className="text-xs text-muted-foreground underline underline-offset-4">
                          +{g.pending_count} to review
                        </Link>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">{g.lead_count.toLocaleString()}</span>
                    </Label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No groups yet.{" "}
                    <Link href="/leads/import" className="text-primary underline-offset-4 hover:underline">
                      Import a CSV
                    </Link>{" "}
                    first.
                  </p>
                )}
                {paused && <p className="text-xs text-muted-foreground">The recipient list is fixed once sending starts.</p>}
              </fieldset>
              <fieldset className="grid content-start gap-2">
                <legend className="mb-2 text-sm font-medium">Send from</legend>
                {mailboxes.isPending ? (
                  <Skeleton className="h-16" />
                ) : mailboxes.data?.length ? (
                  mailboxes.data.map((m) => (
                    <Label key={m.id} className="flex items-center gap-2 font-normal">
                      <Checkbox
                        checked={v.mailbox_ids.includes(m.id)}
                        onCheckedChange={(on) => toggle("mailbox_ids", m.id, on === true)}
                      />
                      <span className="flex-1">
                        {m.display_name} <span className="text-muted-foreground">&lt;{m.email}&gt;</span>
                      </span>
                      {m.status !== "ACTIVE" && (
                        <Badge variant="outline" className="font-normal">
                          {m.status === "PAUSED" ? "Paused" : "Not connected"}
                        </Badge>
                      )}
                    </Label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No mailboxes yet.{" "}
                    <Link href="/mailboxes" className="text-primary underline-offset-4 hover:underline">
                      Add one
                    </Link>{" "}
                    first.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  With several mailboxes, emails are shared between them so the list finishes sooner.
                </p>
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
            <code className="font-mono text-xs">{"{Hi|Hello}"}</code>; each email picks one at random. The footer
            with your address is added automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="flex flex-wrap gap-1.5" aria-label="Insert a field">
              {(fields.data ?? ["email", "first_name", "last_name", "company", "country", "sender_name"]).map((f) => (
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
          <CardTitle>When it sends</CardTitle>
          <CardDescription>
            Each mailbox sends one email, then waits a random gap. Slow and steady keeps fastnexa.com out of spam
            folders.
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
                    min={1}
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
                    min={1}
                    max={1440}
                    value={v.gap_max_seconds / 60}
                    onChange={(e) => set("gap_max_seconds", Math.round(Number(e.target.value) * 60))}
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </Field>
            </div>
            <fieldset className="grid gap-2">
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
            <Label className="flex items-start gap-2 font-normal">
              <Checkbox
                className="mt-0.5"
                checked={v.use_lead_timezone}
                onCheckedChange={(on) => set("use_lead_timezone", on === true)}
              />
              <span className="grid gap-0.5">
                <span>Use each lead&apos;s own timezone</span>
                <span className="text-xs text-muted-foreground">
                  The days and hours above apply in each lead&apos;s local time, so everyone gets the email during
                  their working day. Leads without a known timezone use {v.timezone.replace("_", " ")}.
                </span>
              </span>
            </Label>
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
        <Button type="submit" disabled={pending || !v.name.trim() || !!scheduleError}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
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
