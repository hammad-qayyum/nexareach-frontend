"use client";

import { useMutation } from "@tanstack/react-query";
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
import { api, type Mailbox, type SmtpSecurity, unwrap } from "@/lib/api/client";

const DEFAULT_PORT: Record<SmtpSecurity, number> = { SSL: 465, STARTTLS: 587, NONE: 1025 };

export function MailboxDialog({
  state,
  onOpenChange,
  onSaved,
}: {
  state: { mailbox: Mailbox | null } | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={!!state} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {state && (
          <MailboxForm
            key={state.mailbox?.id ?? "new"}
            mailbox={state.mailbox}
            onCancel={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MailboxForm({
  mailbox,
  onCancel,
  onSaved,
}: {
  mailbox: Mailbox | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(mailbox?.email ?? "");
  const [displayName, setDisplayName] = useState(mailbox?.display_name ?? "");
  const [host, setHost] = useState(mailbox?.smtp_host ?? "");
  const [security, setSecurity] = useState<SmtpSecurity>(mailbox?.smtp_security ?? "SSL");
  const [port, setPort] = useState(String(mailbox?.smtp_port ?? 465));
  const [username, setUsername] = useState(mailbox?.smtp_username ?? "");
  const [password, setPassword] = useState("");
  const [cap, setCap] = useState(String(mailbox?.daily_cap ?? 40));

  const save = useMutation({
    mutationFn: async () => {
      const common = {
        display_name: displayName,
        smtp_host: host,
        smtp_port: Number(port),
        smtp_security: security,
        smtp_username: username || email,
        daily_cap: Number(cap),
      };
      if (mailbox) {
        return unwrap(
          api.PATCH("/api/mailboxes/{mailbox_id}", {
            params: { path: { mailbox_id: mailbox.id } },
            body: { ...common, smtp_password: password || undefined },
          }),
        );
      }
      return unwrap(api.POST("/api/mailboxes", { body: { ...common, email, smtp_password: password } }));
    },
    onSuccess: (m) => {
      toast.success(mailbox ? `Saved ${m.email}.` : `Added ${m.email}. Use "Test connection" to check the login.`);
      onSaved();
    },
  });

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>{mailbox ? `Edit ${mailbox.email}` : "Add a mailbox"}</DialogTitle>
        <DialogDescription>
          Use the outgoing (SMTP) settings from your mail host, for example cPanel&apos;s &quot;Connect Devices&quot;
          page. The password is stored encrypted.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        {save.error && (
          <Alert variant="destructive">
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="mb-email">Email address</FieldLabel>
            <Input
              id="mb-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!mailbox}
              placeholder="ali@fastnexa.com"
              required
              autoFocus={!mailbox}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="mb-name">Sender name</FieldLabel>
            <Input
              id="mb-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ali Khan"
              maxLength={200}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem_6rem]">
          <Field>
            <FieldLabel htmlFor="mb-host">SMTP server</FieldLabel>
            <Input
              id="mb-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="mail.fastnexa.com"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="mb-security">Security</FieldLabel>
            <Select
              value={security}
              onValueChange={(v) => {
                const next = v as SmtpSecurity;
                setSecurity(next);
                setPort(String(DEFAULT_PORT[next]));
              }}
            >
              <SelectTrigger id="mb-security" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SSL">SSL (465)</SelectItem>
                <SelectItem value="STARTTLS">STARTTLS (587)</SelectItem>
                <SelectItem value="NONE">None (testing)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="mb-port">Port</FieldLabel>
            <Input
              id="mb-port"
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="mb-user">Username</FieldLabel>
            <Input
              id="mb-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={email || "Usually the email address"}
              autoComplete="off"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="mb-password">Password</FieldLabel>
            <Input
              id="mb-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={mailbox ? "Leave blank to keep" : undefined}
              required={!mailbox}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="mb-cap">Daily cap</FieldLabel>
          <Input
            id="mb-cap"
            type="number"
            min={1}
            max={500}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            className="w-28"
            required
          />
          <FieldDescription>
            The most emails this mailbox sends per day across all campaigns. 40 is the safe limit for a mailbox
            that hasn&apos;t been warmed up.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : mailbox ? "Save" : "Add mailbox"}
        </Button>
      </DialogFooter>
    </form>
  );
}
