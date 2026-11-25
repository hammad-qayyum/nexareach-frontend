"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { DELIVERABILITY_KEY } from "@/lib/deliverability";
import { isAdmin, useCurrentUser } from "@/lib/session";

const SETTINGS_KEY = ["deliverability", "settings"] as const;
type Settings = Schemas["DeliverabilitySettings"];

/** cPanel's delivery log, the DMARC reports mailbox, the health checks and the alert limits. Admins edit. */
export function DeliverabilitySettings() {
  const settings = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => unwrap(api.GET("/api/deliverability/settings")),
  });
  if (settings.error) return <QueryError error={settings.error} onRetry={() => settings.refetch()} />;
  if (settings.isPending) return <Skeleton className="h-96 max-w-2xl" />;
  const s = settings.data;
  return (
    <section id="deliverability" className="grid scroll-mt-16 gap-6">
      <h2 className="text-lg font-semibold tracking-tight">Deliverability</h2>
      <CpanelForm key={JSON.stringify(s.cpanel)} initial={s.cpanel} />
      <DmarcForm key={JSON.stringify(s.dmarc)} initial={s.dmarc} />
      <ChecksForm key={`${s.dkim_selector}|${s.spamhaus_key_set}`} settings={s} />
      <ThresholdsForm key={JSON.stringify(s.thresholds)} initial={s.thresholds} />
    </section>
  );
}

function useSave<T>(call: (body: T) => Promise<Settings>, success: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_KEY, data);
      queryClient.invalidateQueries({ queryKey: DELIVERABILITY_KEY });
      toast.success(success);
    },
    onError: (e) => toast.error(e.message),
  });
}

function TestResult({ result }: { result: { ok: boolean; detail: string } | null }) {
  if (!result) return null;
  const Icon = result.ok ? CheckCircle2Icon : XCircleIcon;
  return (
    <p className={`flex items-start gap-2 text-sm ${result.ok ? "text-success" : "text-destructive"}`}>
      <Icon className="mt-0.5 size-4 shrink-0" /> {result.detail}
    </p>
  );
}

function CpanelForm({ initial }: { initial: Settings["cpanel"] }) {
  const admin = isAdmin(useCurrentUser().role);
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(String(initial.port));
  const [username, setUsername] = useState(initial.username);
  const [token, setToken] = useState("");
  const [tested, setTested] = useState<{ ok: boolean; detail: string } | null>(null);
  const save = useSave(
    () =>
      unwrap(
        api.PUT("/api/deliverability/settings/cpanel", {
          body: { host, port: Number(port) || 2083, username, token: token || null },
        }),
      ),
    host.trim() ? "cPanel saved. Its delivery log is read every 10 minutes." : "cPanel disconnected.",
  );
  const test = useMutation({
    mutationFn: () => unwrap(api.POST("/api/deliverability/settings/cpanel/test")),
    onSuccess: setTested,
    onError: (e) => toast.error(e.message),
  });
  const unchanged = host === initial.host && port === String(initial.port) && username === initial.username && !token;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>cPanel delivery log</CardTitle>
        <CardDescription>
          Lets the app see what the receiving server did with each email (delivered, delayed, refused). In cPanel open{" "}
          <strong>Security → Manage API Tokens</strong>, create a token named &quot;NexaReach&quot;, and paste it here.
          It is stored encrypted and never shown again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <Field>
              <FieldLabel htmlFor="cp-host">cPanel server</FieldLabel>
              <Input
                id="cp-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="fastnexa.com"
                disabled={!admin}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cp-port">Port</FieldLabel>
              <Input
                id="cp-port"
                inputMode="numeric"
                value={port}
                onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))}
                disabled={!admin}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="cp-user">cPanel username</FieldLabel>
            <Input id="cp-user" value={username} onChange={(e) => setUsername(e.target.value)} disabled={!admin} />
            <FieldDescription>The account&apos;s login name (shown top right in cPanel), not an email address.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="cp-token">API token</FieldLabel>
            <Input
              id="cp-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={initial.token_set ? "Saved (type a new one to replace it)" : "Paste the token"}
              disabled={!admin}
            />
            <FieldDescription>Leave the server empty and save to disconnect.</FieldDescription>
          </Field>
          <TestResult result={tested} />
        </FieldGroup>
      </CardContent>
      {admin && (
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending || !initial.token_set || !unchanged}>
            {test.isPending ? "Testing…" : "Test"}
          </Button>
          <Button onClick={() => save.mutate(undefined)} disabled={save.isPending || unchanged}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function DmarcForm({ initial }: { initial: Settings["dmarc"] }) {
  const admin = isAdmin(useCurrentUser().role);
  const [email, setEmail] = useState(initial.email);
  const [imapHost, setImapHost] = useState(initial.imap_host || "mail.fastnexa.com");
  const [imapPort, setImapPort] = useState(String(initial.imap_port));
  const [password, setPassword] = useState("");
  const [tested, setTested] = useState<{ ok: boolean; detail: string } | null>(null);
  const save = useSave(
    () =>
      unwrap(
        api.PUT("/api/deliverability/settings/dmarc", {
          body: {
            email: email.trim() || null,
            imap_host: imapHost,
            imap_port: Number(imapPort) || 993,
            password: password || null,
          },
        }),
      ),
    email.trim() ? "Reports mailbox saved. It's read every 6 hours." : "Reports mailbox removed.",
  );
  const test = useMutation({
    mutationFn: () => unwrap(api.POST("/api/deliverability/settings/dmarc/test")),
    onSuccess: setTested,
    onError: (e) => toast.error(e.message),
  });
  const unchanged =
    email === initial.email &&
    imapHost === (initial.imap_host || "mail.fastnexa.com") &&
    imapPort === String(initial.imap_port) &&
    !password;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>DMARC reports mailbox</CardTitle>
        <CardDescription>
          Your DMARC record sends daily reports to an address (e.g.{" "}
          <code className="font-mono text-xs">rua=mailto:dmarc@fastnexa.com</code>). If that mailbox doesn&apos;t exist
          yet, create it in cPanel → Email Accounts. The app only reads it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="dm-email">Mailbox</FieldLabel>
            <Input
              id="dm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dmarc@fastnexa.com"
              disabled={!admin}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <Field>
              <FieldLabel htmlFor="dm-host">Incoming mail (IMAP) server</FieldLabel>
              <Input id="dm-host" value={imapHost} onChange={(e) => setImapHost(e.target.value)} disabled={!admin} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dm-port">Port</FieldLabel>
              <Input
                id="dm-port"
                inputMode="numeric"
                value={imapPort}
                onChange={(e) => setImapPort(e.target.value.replace(/\D/g, ""))}
                disabled={!admin}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="dm-password">Password</FieldLabel>
            <Input
              id="dm-password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={initial.password_set ? "Saved (type a new one to replace it)" : "The mailbox's password"}
              disabled={!admin}
            />
            <FieldDescription>Leave the mailbox empty and save to stop reading reports.</FieldDescription>
          </Field>
          <TestResult result={tested} />
        </FieldGroup>
      </CardContent>
      {admin && (
        <CardFooter className="justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => test.mutate()}
            disabled={test.isPending || !initial.password_set || !unchanged}
          >
            {test.isPending ? "Testing…" : "Test"}
          </Button>
          <Button onClick={() => save.mutate(undefined)} disabled={save.isPending || unchanged}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function ChecksForm({ settings }: { settings: Settings }) {
  const admin = isAdmin(useCurrentUser().role);
  const [selector, setSelector] = useState(settings.dkim_selector);
  const [key, setKey] = useState("");
  const [removeKey, setRemoveKey] = useState(false);
  const save = useSave(
    () =>
      unwrap(
        api.PUT("/api/deliverability/settings/checks", {
          body: { dkim_selector: selector.trim(), spamhaus_key: removeKey ? "" : key.trim() || null },
        }),
      ),
    "Health check settings saved.",
  );
  const unchanged = selector === settings.dkim_selector && !key && !removeKey;
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Health checks</CardTitle>
        <CardDescription>
          Every morning the app checks your domain&apos;s SPF, DKIM, DMARC and MX records, the mail server&apos;s
          certificate, and the free blacklists (SpamCop, Barracuda, PSBL).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="dkim-selector">DKIM selector</FieldLabel>
            <Input
              id="dkim-selector"
              className="max-w-48"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              disabled={!admin}
            />
            <FieldDescription>
              cPanel uses &quot;default&quot; (the record <code className="font-mono text-xs">default._domainkey</code>).
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="spamhaus-key">Spamhaus DQS key (optional)</FieldLabel>
            <Input
              id="spamhaus-key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setRemoveKey(false);
              }}
              placeholder={settings.spamhaus_key_set ? "Saved (type a new one to replace it)" : "Not set"}
              disabled={!admin}
            />
            <FieldDescription>
              Spamhaus is the most important blacklist but refuses ordinary lookups. Its free key (spamhaus.com → Data
              Query Service, free for low volume) lets the app ask it too.
              {settings.spamhaus_key_set && admin && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    onClick={() => {
                      setRemoveKey(true);
                      setKey("");
                    }}
                  >
                    {removeKey ? "Will be removed when you save" : "Remove the key"}
                  </button>
                </>
              )}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      {admin && (
        <CardFooter className="justify-end">
          <Button onClick={() => save.mutate(undefined)} disabled={save.isPending || unchanged || !selector.trim()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

type Thresholds = Settings["thresholds"];
type Limit = Exclude<keyof Thresholds, "auto_pause">;
const LIMITS: { key: Limit; label: string; unit: string; help: string; min: number; max: number }[] = [
  {
    key: "hard_bounce_pct",
    label: "Hard bounces",
    unit: "%",
    help: "of a mailbox's recent emails: over this opens an alert",
    min: 0.5,
    max: 50,
  },
  { key: "bounce_window", label: "Recent emails", unit: "emails", help: "how many recent emails the bounce rate looks at", min: 20, max: 1000 },
  { key: "deferred_pct", label: "Delayed", unit: "%", help: "of the last 24 hours' emails still delayed: warns", min: 1, max: 100 },
  { key: "dmarc_pass_pct", label: "DMARC pass rate", unit: "%", help: "below this over 7 days: warns", min: 50, max: 100 },
  { key: "cert_days", label: "Certificate", unit: "days", help: "warn this long before the certificate expires", min: 1, max: 90 },
  {
    key: "placement_spam_pct",
    label: "Placement spam",
    unit: "%",
    help: "of a placement test in spam or missing: warns",
    min: 10,
    max: 100,
  },
];

function ThresholdsForm({ initial }: { initial: Thresholds }) {
  const admin = isAdmin(useCurrentUser().role);
  const [v, setV] = useState<Record<Limit, string>>(
    Object.fromEntries(LIMITS.map((l) => [l.key, String(initial[l.key])])) as Record<Limit, string>,
  );
  const [autoPause, setAutoPause] = useState(initial.auto_pause ?? false);
  const save = useSave(
    () =>
      unwrap(
        api.PUT("/api/deliverability/settings/thresholds", {
          body: {
            ...(Object.fromEntries(LIMITS.map((l) => [l.key, Number(v[l.key])])) as Record<Limit, number>),
            auto_pause: autoPause,
          },
        }),
      ),
    "Alert limits saved.",
  );
  const invalid = LIMITS.some((l) => {
    const n = Number(v[l.key]);
    return !v[l.key] || Number.isNaN(n) || n < l.min || n > l.max;
  });
  const unchanged =
    autoPause === (initial.auto_pause ?? false) && LIMITS.every((l) => Number(v[l.key]) === initial[l.key]);
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Alert limits</CardTitle>
        <CardDescription>
          When deliverability alerts open. Every alert shows here and is emailed to the admins (once an invite
          mailbox is chosen).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <Label className="flex items-start gap-3 font-normal">
          <Checkbox
            className="mt-0.5"
            checked={autoPause}
            onCheckedChange={(on) => setAutoPause(on === true)}
            disabled={!admin}
          />
          <span className="grid gap-1">
            <span className="font-medium">Pause sending on serious problems</span>
            <span className="text-sm text-muted-foreground">
              Too many hard bounces, a blacklisting, broken DNS records or a low warm-up inbox rate stop that
              mailbox&apos;s campaign emails until someone presses Resume. Off: they only warn.
            </span>
          </span>
        </Label>
        <div className="grid gap-4 sm:grid-cols-2">
          {LIMITS.map((l) => (
            <Field key={l.key}>
              <FieldLabel htmlFor={`limit-${l.key}`}>{l.label}</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id={`limit-${l.key}`}
                  inputMode="decimal"
                  className="w-24"
                  value={v[l.key]}
                  onChange={(e) => setV((s) => ({ ...s, [l.key]: e.target.value.replace(/[^\d.]/g, "") }))}
                  disabled={!admin}
                />
                <span className="text-sm text-muted-foreground">{l.unit}</span>
              </div>
              <FieldDescription>
                {l.help} ({l.min}–{l.max}).
              </FieldDescription>
            </Field>
          ))}
        </div>
      </CardContent>
      {admin && (
        <CardFooter className="justify-end">
          <Button onClick={() => save.mutate(undefined)} disabled={save.isPending || unchanged || invalid}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
