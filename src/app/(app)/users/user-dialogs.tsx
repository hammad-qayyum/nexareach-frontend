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
  onInvited: (user: User, inviteUrl: string) => void;
}) {
  const [role, setRole] = useState<Role>("MEMBER");
  const invite = useMutation({
    mutationFn: (body: { name: string; email: string; role: Role }) =>
      unwrap(api.POST("/api/users/invite", { body })),
    onSuccess: (data) => {
      setRole("MEMBER");
      onInvited(data.user, data.invite_url);
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
            <DialogDescription>You&apos;ll get a link to send them. They choose their own password.</DialogDescription>
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

export function InviteLinkDialog({
  link,
  onOpenChange,
}: {
  link: { user: User; url: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!link} onOpenChange={onOpenChange}>
      <DialogContent>
        {link && (
          <>
            <DialogHeader>
              <DialogTitle>Invite link for {link.user.name}</DialogTitle>
              <DialogDescription>
                Send this link to {link.user.email}. It works once, expires in 7 days, and replaces any earlier link.
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-w-0 items-center gap-1 rounded-md border bg-muted/50 p-1 pl-3">
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{link.url}</code>
              <CopyButton value={link.url} label="Copy link" />
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
