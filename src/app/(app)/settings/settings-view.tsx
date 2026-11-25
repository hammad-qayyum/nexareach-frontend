"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SearchableSelect } from "@/components/searchable-select";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { canEdit, useCurrentUser } from "@/lib/session";
import { DAY_LABELS, hourLabel, TIMEZONES } from "../campaigns/campaign-form";
import { DeliverabilitySettings } from "./deliverability-settings";
import { scheduleText, WARMUP_KEY } from "../warmup/warmup-view";

export const FOOTER_QUERY_KEY = ["settings", "footer"] as const;

const INVITES_QUERY_KEY = ["settings", "invites"] as const;
const NO_MAILBOX = "none";

export function SettingsView() {
  const me = useCurrentUser();
  const footer = useQuery({ queryKey: FOOTER_QUERY_KEY, queryFn: () => unwrap(api.GET("/api/settings/footer")) });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Settings"
        description="Your business details, to use in emails, how app emails are sent, and the deliverability checks."
      />
      {footer.error ? (
        <QueryError error={footer.error} onRetry={() => footer.refetch()} />
      ) : footer.isPending ? (
        <Skeleton className="h-72 max-w-2xl" />
      ) : (
        <FooterForm key={`${footer.data.business_name}|${footer.data.postal_address}`} initial={footer.data} />
      )}
      <EmailFooter postalAddress={footer.data?.postal_address ?? ""} />
      <WarmupHours />
      {me.role === "ADMIN" && <InviteEmails />}
      {canEdit(me.role) && <Integrations admin={me.role === "ADMIN"} />}
      <DeliverabilitySettings />
    </div>
  );
}

const EMAIL_FOOTER_KEY = ["settings", "email-footer"] as const;

/** The opt-out line and postal address under every campaign and follow-up email (with List-Unsubscribe). */
function EmailFooter({ postalAddress }: { postalAddress: string }) {
  const footer = useQuery({ queryKey: EMAIL_FOOTER_KEY, queryFn: () => unwrap(api.GET("/api/settings/email-footer")) });
  if (footer.error) return <QueryError error={footer.error} onRetry={() => footer.refetch()} />;
  if (footer.isPending) return <Skeleton className="h-48 max-w-2xl" />;
  return <EmailFooterForm key={JSON.stringify(footer.data)} initial={footer.data} postalAddress={postalAddress} />;
}

function EmailFooterForm({
  initial,
  postalAddress,
}: {
  initial: Schemas["EmailFooterSettings"];
  postalAddress: string;
}) {
  const editable = canEdit(useCurrentUser().role);
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [line, setLine] = useState(initial.optout_line);
  const save = useMutation({
    mutationFn: () => unwrap(api.PUT("/api/settings/email-footer", { body: { enabled, optout_line: line } })),
    onSuccess: (data) => {
      queryClient.setQueryData(EMAIL_FOOTER_KEY, data);
      toast.success(data.enabled ? "Every campaign email now ends with the opt-out line and address." : "Footer switched off.");
    },
    onError: (e) => toast.error(e.message),
  });
  const unchanged = enabled === initial.enabled && line === initial.optout_line;
  const lineError = line.trim().length < 5;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Opt-out line and footer</CardTitle>
        <CardDescription>
          For sending worldwide. When on, every campaign and follow-up email (not warm-up) ends with this line and
          the postal address above, and carries an &ldquo;Unsubscribe&rdquo; header that mail apps show as a button.
          A reply saying stop, or the button, puts the person on do-not-contact.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Label className="flex items-start gap-3 font-normal">
            <Checkbox
              className="mt-0.5"
              checked={enabled}
              onCheckedChange={(on) => setEnabled(on === true)}
              disabled={!editable}
            />
            <span className="grid gap-1">
              <span className="font-medium">Add the opt-out line and postal address to every campaign email</span>
              {!postalAddress.trim() && (
                <span className="text-sm text-destructive">Add the postal address above first.</span>
              )}
            </span>
          </Label>
          <Field>
            <FieldLabel htmlFor="optout-line">Opt-out line</FieldLabel>
            <Input
              id="optout-line"
              value={line}
              onChange={(e) => setLine(e.target.value)}
              maxLength={300}
              disabled={!editable}
              aria-invalid={lineError}
            />
            <FieldDescription>The last line of every email, above the address.</FieldDescription>
          </Field>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="mb-2 text-xs font-medium text-muted-foreground">How the end of an email looks</p>
            <p className="text-muted-foreground">… your message …</p>
            <p className="mt-3">{line || "—"}</p>
            {postalAddress.trim() && <p className="mt-3 whitespace-pre-line text-xs text-muted-foreground">{postalAddress}</p>}
          </div>
        </FieldGroup>
      </CardContent>
      {editable && (
        <CardFooter className="justify-end">
          <Button onClick={() => save.mutate()} disabled={unchanged || lineError || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

const LINK_ROW =
  "flex items-center justify-between gap-4 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50";

/** Links to the Deals connection (admins) and the reply score (admins edit; members can use Try it). */
function Integrations({ admin }: { admin: boolean }) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>Connections to the company&apos;s other apps.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {admin && (
          <Link href="/settings/deals" className={LINK_ROW}>
            <span className="grid gap-0.5">
              <span className="font-medium">Deals CRM</span>
              <span className="text-muted-foreground">
                The do-not-email list, opt-outs, handovers and results, shared with deals.fastnexa.com.
              </span>
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        )}
        <Link href="/settings/scoring" className={LINK_ROW}>
          <span className="grid gap-0.5">
            <span className="font-medium">Reply score</span>
            <span className="text-muted-foreground">
              The word rules and cut-offs that decide which replies go to Deals. Never AI.
            </span>
          </span>
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </CardContent>
    </Card>
  );
}

/** Admins only: which mailbox emails invite links (or none: the admin sends the link themselves). */
function InviteEmails() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: INVITES_QUERY_KEY, queryFn: () => unwrap(api.GET("/api/settings/invites")) });
  const mailboxes = useQuery({ queryKey: ["mailboxes"], queryFn: () => unwrap(api.GET("/api/mailboxes")) });
  const save = useMutation({
    mutationFn: (mailboxId: number | null) => unwrap(api.PUT("/api/settings/invites", { body: { mailbox_id: mailboxId } })),
    onSuccess: (data) => {
      queryClient.setQueryData(INVITES_QUERY_KEY, data);
      toast.success(data.mailbox_id ? "Invites and alerts will be emailed from this mailbox." : "Invites and alerts won't be emailed.");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Invite and alert emails</CardTitle>
        <CardDescription>
          When you invite someone on the Users page, the app can email them the link (it is always shown too, so you
          can copy it if the email doesn&apos;t arrive). Deliverability alerts are emailed to every admin from the same
          mailbox.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {settings.error || mailboxes.error ? (
          <QueryError error={(settings.error ?? mailboxes.error)!} onRetry={() => (settings.refetch(), mailboxes.refetch())} />
        ) : settings.isPending || mailboxes.isPending ? (
          <Skeleton className="h-10" />
        ) : (
          <Field>
            <FieldLabel htmlFor="invite-mailbox">Send invite and alert emails from</FieldLabel>
            <SearchableSelect
              id="invite-mailbox"
              className="w-full max-w-md"
              value={settings.data.mailbox_id ? String(settings.data.mailbox_id) : NO_MAILBOX}
              onValueChange={(v) => save.mutate(v === NO_MAILBOX ? null : Number(v))}
              disabled={save.isPending}
              searchLabel="Search mailboxes"
              options={[
                { value: NO_MAILBOX, label: "Don't send them (alerts only show in the app)", divider: true },
                ...mailboxes.data.map((m) => ({ value: String(m.id), label: `${m.display_name} <${m.email}>` })),
              ]}
            />
            <FieldDescription>
              They go out straight away and don&apos;t count towards the mailbox&apos;s daily limit.
            </FieldDescription>
          </Field>
        )}
      </CardContent>
    </Card>
  );
}

function FooterForm({ initial }: { initial: { business_name: string; postal_address: string } }) {
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const queryClient = useQueryClient();
  const [businessName, setBusinessName] = useState(initial.business_name);
  const [address, setAddress] = useState(initial.postal_address);
  const save = useMutation({
    mutationFn: () =>
      unwrap(api.PUT("/api/settings/footer", { body: { business_name: businessName, postal_address: address } })),
    onSuccess: (data) => {
      queryClient.setQueryData(FOOTER_QUERY_KEY, data);
      toast.success("Business details saved.");
    },
    onError: (e) => toast.error(e.message),
  });
  const unchanged = businessName === initial.business_name && address === initial.postal_address;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Business details</CardTitle>
        <CardDescription>
          Unless the opt-out footer below is on, nothing is added to your emails automatically. To include these,
          type{" "}
          <code className="font-mono text-xs">{"{{business_name}}"}</code> or{" "}
          <code className="font-mono text-xs">{"{{postal_address}}"}</code> in a message. Emails to people in the US
          or Canada must include a postal address and a way to opt out.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="business-name">Business name</FieldLabel>
            <Input
              id="business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              maxLength={200}
              disabled={!editable}
              placeholder="FastNexa"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="postal-address">Postal address</FieldLabel>
            <Textarea
              id="postal-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={!editable}
              placeholder="Office 4, 12 Main Boulevard, Lahore, Pakistan"
            />
            <FieldDescription>Keep it to one or two lines.</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      {editable && (
        <CardFooter className="justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending || unchanged}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}


/** When warm-up emails go out, for every mailbox. */
function WarmupHours() {
  const schedule = useQuery({
    queryKey: [...WARMUP_KEY, "schedule"],
    queryFn: () => unwrap(api.GET("/api/warmup/schedule")),
  });
  if (schedule.error) return <QueryError error={schedule.error} onRetry={() => schedule.refetch()} />;
  if (schedule.isPending) return <Skeleton className="h-48 max-w-2xl" />;
  return <WarmupHoursForm key={JSON.stringify(schedule.data)} initial={schedule.data} />;
}

function WarmupHoursForm({ initial }: { initial: Schemas["ScheduleIO"] }) {
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const queryClient = useQueryClient();
  const [v, setV] = useState(initial);
  const save = useMutation({
    mutationFn: () => unwrap(api.PUT("/api/warmup/schedule", { body: v })),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: WARMUP_KEY });
      toast.success(`Warm-up emails now go out ${scheduleText(data)}.`);
    },
    onError: (e) => toast.error(e.message),
  });
  const unchanged = JSON.stringify(v) === JSON.stringify(initial);
  const invalid = v.end_hour <= v.start_hour || v.days.length === 0;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Warm-up hours</CardTitle>
        <CardDescription>
          When warm-up emails go out, at random moments, for every mailbox with warm-up on. Working days and hours look
          most natural.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <fieldset className="min-w-0" disabled={!editable}>
            <legend className="mb-2 text-sm font-medium">Days</legend>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, d) => {
                const on = v.days.includes(d);
                return (
                  <Button
                    key={label}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    onClick={() =>
                      setV((s) => ({ ...s, days: on ? s.days.filter((x) => x !== d) : [...s.days, d].sort() }))
                    }
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-28">
              <FieldLabel htmlFor="wu-start">From</FieldLabel>
              <Select
                value={String(v.start_hour)}
                onValueChange={(x) => setV((s) => ({ ...s, start_hour: Number(x) }))}
                disabled={!editable}
              >
                <SelectTrigger id="wu-start" className="w-full">
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
              <FieldLabel htmlFor="wu-end">Until</FieldLabel>
              <Select
                value={String(v.end_hour)}
                onValueChange={(x) => setV((s) => ({ ...s, end_hour: Number(x) }))}
                disabled={!editable}
              >
                <SelectTrigger id="wu-end" className="w-full">
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
              <FieldLabel htmlFor="wu-tz">Timezone</FieldLabel>
              <Select value={v.timezone} onValueChange={(x) => setV((s) => ({ ...s, timezone: x }))} disabled={!editable}>
                <SelectTrigger id="wu-tz" className="w-full">
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
          {invalid ? (
            <p className="text-sm text-destructive">Choose at least one day, and an end after the start.</p>
          ) : (
            <FieldDescription>Warm-up emails go out {scheduleText(v)}.</FieldDescription>
          )}
        </FieldGroup>
      </CardContent>
      {editable && (
        <CardFooter className="justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending || unchanged || invalid}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
