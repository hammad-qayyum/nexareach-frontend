"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontalIcon, PlusIcon, ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, unwrap, type User, type UserStatus } from "@/lib/api/client";
import { formatDate, formatRelative } from "@/lib/format";
import { isAdmin, ROLE_LABELS, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { EditUserDialog, InviteDialog, InviteLinkDialog } from "./user-dialogs";
import { UserStatusBadge } from "./user-status-badge";

export const USERS_QUERY_KEY = ["users"] as const;

type Confirm = { kind: "remove" | "cancel-invite" | "reset-2fa"; user: User };

export function UsersView() {
  const me = useCurrentUser();
  if (!isAdmin(me.role)) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Users" />
        <Forbidden />
      </div>
    );
  }
  return <UsersAdmin />;
}

function UsersAdmin() {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [link, setLink] = useState<{ user: User; url: string } | null>(null);

  const users = useQuery({ queryKey: USERS_QUERY_KEY, queryFn: () => unwrap(api.GET("/api/users")) });

  const onUserChanged = () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });

  const setStatus = useMutation({
    mutationFn: ({ user, status }: { user: User; status: UserStatus }) =>
      unwrap(api.PATCH("/api/users/{user_id}", { params: { path: { user_id: user.id } }, body: { status } })),
    onSuccess: (user) => {
      toast.success(`${user.name} is now ${STATUS_VERB[user.status]}.`);
      onUserChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  const resend = useMutation({
    mutationFn: (user: User) =>
      unwrap(api.POST("/api/users/{user_id}/resend-invite", { params: { path: { user_id: user.id } } })),
    onSuccess: (data, user) => setLink({ user, url: data.invite_url }),
    onError: (e) => toast.error(e.message),
  });

  const reset2fa = useMutation({
    mutationFn: (user: User) =>
      unwrap(api.POST("/api/users/{user_id}/reset-2fa", { params: { path: { user_id: user.id } } })),
    onSuccess: (user) => {
      toast.success(`2-step sign-in reset for ${user.name}. They'll set it up again next time they sign in.`);
      onUserChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  function runConfirm() {
    if (!confirm) return;
    if (confirm.kind === "reset-2fa") reset2fa.mutate(confirm.user);
    else setStatus.mutate({ user: confirm.user, status: "REMOVED" });
    setConfirm(null);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Users"
        description="Invite people and manage their roles and access. Role and access changes sign the person out."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <PlusIcon data-icon="inline-start" /> Invite user
          </Button>
        }
      />

      {users.error ? (
        <QueryError error={users.error} onRetry={() => users.refetch()} />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>2-step</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.isPending
                ? Array.from({ length: 3 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="pl-4">
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : users.data.map((user) => {
                    const self = user.id === me.id;
                    return (
                      <TableRow key={user.id} className={cn(user.status === "REMOVED" && "text-muted-foreground")}>
                        <TableCell className="pl-4">
                          <div className="grid leading-tight">
                            <span className="font-medium">
                              {user.name}
                              {self && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                            </span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                        <TableCell>
                          <UserStatusBadge status={user.status} />
                        </TableCell>
                        <TableCell>
                          {user.totp_enabled ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <ShieldCheckIcon className="size-4 text-success" aria-label="On" />
                              </TooltipTrigger>
                              <TooltipContent>2-step sign-in is on</TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">Off</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.last_login_at ? formatRelative(user.last_login_at) : "Never"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(user.created_at)}</TableCell>
                        <TableCell className="pr-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.name}`}>
                                <MoreHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-44">
                              <DropdownMenuItem onSelect={() => setEditing(user)}>Edit</DropdownMenuItem>
                              {user.status === "INVITED" && (
                                <DropdownMenuItem onSelect={() => resend.mutate(user)}>New invite link</DropdownMenuItem>
                              )}
                              {user.totp_enabled && !self && (
                                <DropdownMenuItem onSelect={() => setConfirm({ kind: "reset-2fa", user })}>
                                  Reset 2-step sign-in
                                </DropdownMenuItem>
                              )}
                              {!self && (
                                <>
                                  <DropdownMenuSeparator />
                                  {user.status === "ACTIVE" && (
                                    <DropdownMenuItem onSelect={() => setStatus.mutate({ user, status: "PAUSED" })}>
                                      Pause access
                                    </DropdownMenuItem>
                                  )}
                                  {(user.status === "PAUSED" || user.status === "REMOVED") && (
                                    <DropdownMenuItem onSelect={() => setStatus.mutate({ user, status: "ACTIVE" })}>
                                      Reactivate
                                    </DropdownMenuItem>
                                  )}
                                  {user.status === "INVITED" && (
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onSelect={() => setConfirm({ kind: "cancel-invite", user })}
                                    >
                                      Cancel invite
                                    </DropdownMenuItem>
                                  )}
                                  {(user.status === "ACTIVE" || user.status === "PAUSED") && (
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onSelect={() => setConfirm({ kind: "remove", user })}
                                    >
                                      Remove
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </div>
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={(user, url) => {
          onUserChanged();
          setInviteOpen(false);
          setLink({ user, url });
        }}
      />
      <EditUserDialog
        user={editing}
        isSelf={editing?.id === me.id}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onUserChanged();
        }}
      />
      <InviteLinkDialog link={link} onOpenChange={(open) => !open && setLink(null)} />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          {confirm && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{CONFIRM_TEXT[confirm.kind].title(confirm.user)}</AlertDialogTitle>
                <AlertDialogDescription>{CONFIRM_TEXT[confirm.kind].body(confirm.user)}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={runConfirm}>
                  {CONFIRM_TEXT[confirm.kind].action}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const STATUS_VERB: Record<UserStatus, string> = {
  ACTIVE: "active",
  PAUSED: "paused",
  REMOVED: "removed",
  INVITED: "invited",
};

const CONFIRM_TEXT: Record<Confirm["kind"], { title: (u: User) => string; body: (u: User) => string; action: string }> =
  {
    remove: {
      title: (u) => `Remove ${u.name}?`,
      body: () =>
        "They're signed out straight away and can't sign in again. Their history stays in the activity log. You can reactivate them later.",
      action: "Remove",
    },
    "cancel-invite": {
      title: (u) => `Cancel the invite for ${u.name}?`,
      body: () => "Their invite link stops working. Invite them again if you change your mind.",
      action: "Cancel invite",
    },
    "reset-2fa": {
      title: (u) => `Reset 2-step sign-in for ${u.name}?`,
      body: () =>
        "Use this when someone has lost their authenticator. They're signed out and set up a new authenticator the next time they sign in.",
      action: "Reset",
    },
  };
