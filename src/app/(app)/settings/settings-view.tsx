"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SearchableSelect } from "@/components/searchable-select";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
      <WarmupHours />
      {me.role === "ADMIN" && <InviteEmails />}
      <DeliverabilitySettings />
    </div>
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
          Nothing is added to your emails automatically. To include these, type{" "}
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
          <fieldset className="grid gap-2" disabled={!editable}>
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
