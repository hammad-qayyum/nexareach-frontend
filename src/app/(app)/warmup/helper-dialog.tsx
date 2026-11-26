"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type Schemas, type SmtpSecurity, unwrap } from "@/lib/api/client";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

type Helper = Schemas["HelperOut"];
type Provider = Helper["provider"];
type Choice = Provider | "LOCAL";

export const PROVIDER_LABEL: Record<Provider, string> = {
  GMAIL: "Gmail",
  OUTLOOK: "Outlook",
  YAHOO: "Yahoo",
  OTHER: "Other",
};

type Preset = {
  label: string;
  smtp_host: string;
  smtp_port: number;
  smtp_security: SmtpSecurity;
  imap_host: string;
  imap_port: number;
  passwordLabel: string;
  steps: React.ReactNode[];
};

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      {children}
    </a>
  );
}

const PRESETS: Record<Choice, Preset> = {
  GMAIL: {
    label: "Gmail",
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
    smtp_security: "SSL",
    imap_host: "imap.gmail.com",
    imap_port: 993,
    passwordLabel: "App password (16 letters)",
    steps: [
      <>
        Sign in to the Gmail account and turn on{" "}
        <Ext href="https://myaccount.google.com/signinoptions/twosv">2-Step Verification</Ext>.
      </>,
      <>
        Open <Ext href="https://myaccount.google.com/apppasswords">App passwords</Ext>, create one named
        &ldquo;NexaReach&rdquo; and copy the 16 letters.
      </>,
      <>Paste them below. IMAP is on by default in Gmail.</>,
    ],
  },
  OUTLOOK: {
    label: "Outlook / Hotmail",
    smtp_host: "smtp-mail.outlook.com",
    smtp_port: 587,
    smtp_security: "STARTTLS",
    imap_host: "outlook.office365.com",
    imap_port: 993,
    passwordLabel: "App password",
    steps: [
      <>
        Turn on <Ext href="https://account.microsoft.com/security">two-step verification</Ext> for the account.
      </>,
      <>
        Create an <Ext href="https://account.live.com/proofs/AppPassword">app password</Ext> and paste it below.
      </>,
      <>
        Microsoft often refuses passwords for outside apps. If the test fails, use a Gmail, Yahoo or company-domain
        helper for now; &ldquo;Connect with Microsoft&rdquo; can be added later.
      </>,
    ],
  },
  YAHOO: {
    label: "Yahoo",
    smtp_host: "smtp.mail.yahoo.com",
    smtp_port: 465,
    smtp_security: "SSL",
    imap_host: "imap.mail.yahoo.com",
    imap_port: 993,
    passwordLabel: "App password",
    steps: [
      <>
        Sign in and open <Ext href="https://login.yahoo.com/account/security">Account security</Ext>.
      </>,
      <>Choose &ldquo;Generate app password&rdquo;, name it &ldquo;NexaReach&rdquo; and paste it below.</>,
    ],
  },
  OTHER: {
    label: "Other / company domain",
    smtp_host: "",
    smtp_port: 465,
    smtp_security: "SSL",
    imap_host: "",
    imap_port: 993,
    passwordLabel: "Password",
    steps: [
      <>
        Use the account&apos;s mail server settings. On cPanel hosting both servers are usually{" "}
        <code className="font-mono text-xs">mail.yourdomain.com</code>: sending 465 (SSL), incoming 993.
      </>,
      <>Use the mailbox&apos;s normal password, or an app password if the provider asks for one.</>,
    ],
  },
  LOCAL: {
    label: "Test server (this computer)",
    smtp_host: "localhost",
    smtp_port: 1025,
    smtp_security: "NONE",
    imap_host: "localhost",
    imap_port: 3143,
    passwordLabel: "Password",
    steps: [
      <>
        Development only. Use an address ending in <code className="font-mono text-xs">@warmup.example.com</code>; the test
        mail server accepts any, with the password <code className="font-mono text-xs">mailpit</code>.
      </>,
    ],
  },
};

function guessChoice(email: string): Choice | null {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (["gmail.com", "googlemail.com"].includes(domain)) return "GMAIL";
  if (/^(outlook|hotmail|live|msn)\./.test(domain)) return "OUTLOOK";
  if (domain.startsWith("yahoo.") || domain === "ymail.com") return "YAHOO";
  if (domain === "warmup.example.com") return "LOCAL";
  return null;
}

/** Add a helper account (helper = "new") or edit one. */
export function HelperDialog({ helper, onOpenChange }: { helper: Helper | "new" | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={!!helper} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        {helper && (
          <HelperForm key={helper === "new" ? "new" : helper.id} initial={helper === "new" ? null : helper} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function HelperForm({ initial, onDone }: { initial: Helper | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const development = useMe().data?.environment === "development";
  const [helper, setHelper] = useState<Helper | null>(initial);
  const [choice, setChoice] = useState<Choice>(initial?.provider ?? (development ? "LOCAL" : "GMAIL"));
  const preset = PRESETS[choice];
  const [email, setEmail] = useState(initial?.email ?? "");
  const [name, setName] = useState(initial?.display_name ?? "");
  const [password, setPassword] = useState("");
  const [smtpHost, setSmtpHost] = useState(initial?.smtp_host ?? preset.smtp_host);
  const [smtpPort, setSmtpPort] = useState(String(initial?.smtp_port ?? preset.smtp_port));
  const [security, setSecurity] = useState<SmtpSecurity>(initial?.smtp_security ?? preset.smtp_security);
  const [imapHost, setImapHost] = useState(initial?.imap_host ?? preset.imap_host);
  const [imapPort, setImapPort] = useState(String(initial?.imap_port ?? preset.imap_port));
  const [failure, setFailure] = useState<string | null>(null);
  const [showServers, setShowServers] = useState(choice === "OTHER" || !!initial);

  function pick(next: Choice) {
    setChoice(next);
    const p = PRESETS[next];
    setSmtpHost(p.smtp_host);
    setSmtpPort(String(p.smtp_port));
    setSecurity(p.smtp_security);
    setImapHost(p.imap_host);
    setImapPort(String(p.imap_port));
    setShowServers(next === "OTHER");
  }

  const save = useMutation({
    mutationFn: async () => {
      const servers = {
        smtp_host: smtpHost.trim(),
        smtp_port: Number(smtpPort),
        smtp_security: security,
        imap_host: imapHost.trim(),
        imap_port: Number(imapPort) || 993,
        provider: choice === "LOCAL" ? ("OTHER" as const) : choice === "OTHER" ? null : choice,
      };
      if (helper) {
        return unwrap(
          api.PATCH("/api/warmup/helpers/{helper_id}", {
            params: { path: { helper_id: helper.id } },
            body: { ...servers, display_name: name, password: password || undefined },
          }),
        );
      }
      return unwrap(api.POST("/api/warmup/helpers", { body: { ...servers, email, display_name: name, password } }));
    },
    onSuccess: (h) => {
      queryClient.invalidateQueries({ queryKey: ["warmup"] });
      if (h.connection && !h.connection.ok) {
        // Saved but not working: stay open to fix it.
        setHelper(h);
        setFailure(h.connection.detail);
        return;
      }
      toast.success(h.connection?.ok ? `${h.email} is ready. ${h.connection.detail}` : `Saved ${h.email}.`);
      onDone();
    },
  });

  const choices: Choice[] = development ? ["LOCAL", "GMAIL", "OUTLOOK", "YAHOO", "OTHER"] : ["GMAIL", "OUTLOOK", "YAHOO", "OTHER"];

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>{helper ? `Edit ${helper.email}` : "Add a helper account"}</DialogTitle>
        <DialogDescription>
          An inbox you own that receives warm-up emails. The connection is tested when you save. The password is stored
          encrypted.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Provider</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Provider">
          {choices.map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={choice === c ? "default" : "outline"}
              role="radio"
              aria-checked={choice === c}
              onClick={() => pick(c)}
            >
              {PRESETS[c].label}
            </Button>
          ))}
        </div>
        <ol className="grid list-decimal gap-1 rounded-lg border bg-muted/30 py-3 pr-3 pl-8 text-sm">
          {preset.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      <FieldGroup>
        {failure && !save.isPending && (
          <Alert variant="destructive">
            <AlertDescription>
              Saved, but it can&apos;t sign in yet: {failure} Fix the details and save again.
            </AlertDescription>
          </Alert>
        )}
        {save.error && (
          <Alert variant="destructive">
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="h-email">Email address</FieldLabel>
            <Input
              id="h-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                const guessed = guessChoice(e.target.value);
                if (!helper && guessed && guessed !== choice && (guessed !== "LOCAL" || development)) pick(guessed);
              }}
              disabled={!!helper}
              placeholder={choice === "LOCAL" ? "helper4@warmup.example.com" : "name@gmail.com"}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="h-name">Name</FieldLabel>
            <Input id="h-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hamza Ali" required />
            <FieldDescription>Used in greetings, like a real contact.</FieldDescription>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="h-password">{preset.passwordLabel}</FieldLabel>
          <Input
            id="h-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={helper ? "Leave empty to keep the current one" : ""}
            required={!helper}
          />
        </Field>

        {!showServers ? (
          <button
            type="button"
            className="w-fit text-left text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => setShowServers(true)}
          >
            Servers: {smtpHost}:{smtpPort} and {imapHost}:{imapPort}. Change
          </button>
        ) : (
          <div className={cn("grid gap-4 rounded-lg border p-3")}>
            <div className="grid gap-4 sm:grid-cols-[1fr_6rem_8rem]">
              <Field>
                <FieldLabel htmlFor="h-smtp">Sending (SMTP) server</FieldLabel>
                <Input id="h-smtp" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="mail.yourdomain.com" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="h-smtp-port">Port</FieldLabel>
                <Input id="h-smtp-port" type="number" min={1} max={65535} value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="h-security">Security</FieldLabel>
                <Select value={security} onValueChange={(v) => setSecurity(v as SmtpSecurity)}>
                  <SelectTrigger id="h-security" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SSL">SSL (465)</SelectItem>
                    <SelectItem value="STARTTLS">STARTTLS (587)</SelectItem>
                    {development && <SelectItem value="NONE">None (test)</SelectItem>}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_6rem_8rem]">
              <Field>
                <FieldLabel htmlFor="h-imap">Incoming (IMAP) server</FieldLabel>
                <Input id="h-imap" value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="mail.yourdomain.com" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="h-imap-port">Port</FieldLabel>
                <Input id="h-imap-port" type="number" min={1} max={65535} value={imapPort} onChange={(e) => setImapPort(e.target.value)} required />
              </Field>
            </div>
          </div>
        )}
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {failure ? "Close" : "Cancel"}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving and testing…" : helper ? "Save and test" : "Add and test"}
        </Button>
      </DialogFooter>
    </form>
  );
}
