"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
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
import { api, unwrap, type Role, type User } from "@/lib/api/client";
import { ROLE_LABELS } from "@/lib/session";

const ROLES: Role[] = ["ADMIN", "MEMBER", "VIEWER"];

const ROLE_HELP: Record<Role, string> = {
  ADMIN: "Everything, including managing users. Must use 2-step sign-in.",
  MEMBER: "Leads, campaigns, mailboxes and settings. Can't manage users.",
  VIEWER: "Can view everything and export CSVs, but can't change anything.",
};

function RoleField({ value, onChange, disabled }: { value: Role; onChange: (r: Role) => void; disabled?: boolean }) {
  return (
    <Field>
      <FieldLabel htmlFor="role">Role</FieldLabel>
      <Select value={value} onValueChange={(v) => onChange(v as Role)} disabled={disabled}>
        <SelectTrigger id="role" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>{disabled ? "You can't change your own role." : ROLE_HELP[value]}</FieldDescription>
    </Field>
  );
}

export function InviteDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (link: InviteLink) => void;
}) {
  const [role, setRole] = useState<Role>("MEMBER");
  const invite = useMutation({
    mutationFn: (body: { name: string; email: string; role: Role }) =>
      unwrap(api.POST("/api/users/invite", { body })),
    onSuccess: (data) => {
      setRole("MEMBER");
      onInvited({ user: data.user, url: data.invite_url, emailSent: data.email_sent ?? null, emailDetail: data.email_detail ?? null });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) invite.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          className="grid gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            invite.mutate({ name: String(form.get("name")), email: String(form.get("email")), role });
          }}
        >
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>
              They get a link to choose their own password. It&apos;s emailed to them if invite emails are set up in
              Settings, and you can always copy it yourself.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {invite.error && (
              <Alert variant="destructive">
                <AlertDescription>{invite.error.message}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel htmlFor="invite-name">Name</FieldLabel>
              <Input id="invite-name" name="name" maxLength={200} autoComplete="off" required autoFocus />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-email">Email</FieldLabel>
              <Input id="invite-email" name="email" type="email" autoComplete="off" required />
            </Field>
            <RoleField value={role} onChange={setRole} />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? "Inviting…" : "Create invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditUserDialog({
  user,
  isSelf,
  onOpenChange,
  onSaved,
}: {
  user: User | null;
  isSelf: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Keyed so the form starts from the selected user's current values each time. */}
        {user && <EditUserForm key={user.id} user={user} isSelf={isSelf} onCancel={() => onOpenChange(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function EditUserForm({
  user,
  isSelf,
  onCancel,
  onSaved,
}: {
  user: User;
  isSelf: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PATCH("/api/users/{user_id}", {
          params: { path: { user_id: user.id } },
          body: { name: name.trim() !== user.name ? name : undefined, role: role !== user.role ? role : undefined },
        }),
      ),
    onSuccess: (saved) => {
      toast.success(`Saved changes to ${saved.name}.`);
      onSaved();
    },
  });
  const unchanged = name.trim() === user.name && role === user.role;

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit {user.name}</DialogTitle>
        <DialogDescription>{user.email}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        {save.error && (
          <Alert variant="destructive">
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="edit-name">Name</FieldLabel>
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
        </Field>
        <RoleField value={role} onChange={setRole} disabled={isSelf} />
        {role !== user.role && (
          <p className="text-sm text-muted-foreground">Changing the role signs {user.name} out everywhere.</p>
        )}
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending || unchanged}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** An invite link, and whether it was emailed (null: invite emails aren't set up). */
export type InviteLink = { user: User; url: string; emailSent: boolean | null; emailDetail: string | null };

export function InviteLinkDialog({
  link,
  onOpenChange,
}: {
  link: InviteLink | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!link} onOpenChange={onOpenChange}>
      <DialogContent>
        {link && (
          <>
            <DialogHeader>
              <DialogTitle>{link.emailSent ? `Invite sent to ${link.user.name}` : `Invite link for ${link.user.name}`}</DialogTitle>
              <DialogDescription>
                {link.emailSent
                  ? `${link.emailDetail ?? `Emailed to ${link.user.email}.`} The link is below too, in case it doesn't arrive.`
                  : `Send this link to ${link.user.email}.`}{" "}
                It works once, expires in 7 days, and replaces any earlier link.
              </DialogDescription>
            </DialogHeader>
            {link.emailSent === false && (
              <Alert variant="destructive">
                <AlertDescription>
                  The invite email couldn&apos;t be sent. {link.emailDetail} Copy the link and send it yourself.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex min-w-0 items-center gap-1 rounded-md border bg-muted/50 p-1 pl-3">
              <code className="min-w-0 flex-1 truncate font-mono text-xs select-all">{link.url}</code>
              <CopyButton value={link.url} label="Copy link" />
            </div>
            <WrongAddressWarning url={link.url} />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The link's address comes from APP_BASE_URL on the server. Warn when it isn't the address in use. */
function WrongAddressWarning({ url }: { url: string }) {
  let linkOrigin: string;
  try {
    linkOrigin = new URL(url).origin;
  } catch {
    return null;
  }
  const here = window.location.origin;
  if (linkOrigin === here) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>
        This link starts with {linkOrigin}, but you&apos;re using {here}, so it may not open for the person you
        invite. Set <code className="font-mono text-xs">APP_BASE_URL={here}</code> in the backend settings, restart the
        API, then choose &ldquo;New invite link&rdquo; for this user.
      </AlertDescription>
    </Alert>
  );
}
