"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { StatusBadge, type Tone } from "@/components/status-dot";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, type Mailbox, type MailboxStatus, unwrap } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import { canEdit, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { MailboxDialog } from "./mailbox-dialog";

export const MAILBOXES_QUERY_KEY = ["mailboxes"] as const;

export const MAILBOX_STATUS: Record<MailboxStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "good" },
  PAUSED: { label: "Paused", tone: "muted" },
  ERROR: { label: "Not connected", tone: "bad" },
};

const SECURITY_LABEL = { SSL: "SSL", STARTTLS: "STARTTLS", NONE: "No encryption" } as const;

export function MailboxesView() {
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ mailbox: Mailbox | null } | null>(null);
  const [deleting, setDeleting] = useState<Mailbox | null>(null);
  const [archiving, setArchiving] = useState<Mailbox | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // This page also lists archived mailboxes (behind a switch); campaign forms only get the others.
  const mailboxes = useQuery({
    queryKey: [...MAILBOXES_QUERY_KEY, "with-archived"],
    queryFn: () => unwrap(api.GET("/api/mailboxes", { params: { query: { include_archived: true } } })),
    refetchInterval: 30_000,
  });
  const archivedCount = (mailboxes.data ?? []).filter((m) => m.archived_at).length;
  const shown = (mailboxes.data ?? []).filter((m) => showArchived || !m.archived_at);
  const refresh = () => queryClient.invalidateQueries({ queryKey: MAILBOXES_QUERY_KEY });

  const check = useMutation({
    mutationFn: (m: Mailbox) =>
      unwrap(api.POST("/api/mailboxes/{mailbox_id}/check", { params: { path: { mailbox_id: m.id } } })),
    onSuccess: (result, m) => {
      if (result.ok) toast.success(`${m.email}: ${result.detail}`);
      else toast.error(`${m.email} is not connected: ${result.detail}`);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: ({ m, status }: { m: Mailbox; status: MailboxStatus }) =>
      unwrap(api.PATCH("/api/mailboxes/{mailbox_id}", { params: { path: { mailbox_id: m.id } }, body: { status } })),
    onSuccess: (m) => {
      if (m.connection && !m.connection.ok) toast.error(`${m.email} is still not connected: ${m.connection.detail}`);
      else toast.success(`${m.email} is now ${MAILBOX_STATUS[m.status].label.toLowerCase()}.`);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (m: Mailbox) =>
      unwrap(api.DELETE("/api/mailboxes/{mailbox_id}", { params: { path: { mailbox_id: m.id } } })),
    onSuccess: () => {
      toast.success("Mailbox deleted.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const archive = useMutation({
    mutationFn: ({ m, restore }: { m: Mailbox; restore: boolean }) =>
      unwrap(
        api.POST(restore ? "/api/mailboxes/{mailbox_id}/restore" : "/api/mailboxes/{mailbox_id}/archive", {
          params: { path: { mailbox_id: m.id } },
        }),
      ),
    onSuccess: (m, { restore }) => {
      toast.success(
        restore
          ? `${m.email} is back, paused. Use "Test and activate" to send from it again.`
          : `${m.email} archived. It won't send, and its history is kept.`,
      );
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Mailboxes"
        description="The fastnexa.com mailboxes campaigns send from. Each sends at most its daily cap, one email at a time."
        actions={
          editable && (
            <Button onClick={() => setDialog({ mailbox: null })}>
              <PlusIcon data-icon="inline-start" /> Add mailbox
            </Button>
          )
        }
      />

      {mailboxes.error ? (
        <QueryError error={mailboxes.error} onRetry={() => mailboxes.refetch()} />
      ) : mailboxes.isPending ? (
        <Skeleton className="h-40" />
      ) : shown.length === 0 && archivedCount === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailIcon />
            </EmptyMedia>
            <EmptyTitle>No mailboxes yet</EmptyTitle>
            <EmptyDescription>Add the fastnexa.com mailbox your campaigns will send from.</EmptyDescription>
          </EmptyHeader>
          {editable && (
            <EmptyContent>
              <Button onClick={() => setDialog({ mailbox: null })}>
                <PlusIcon data-icon="inline-start" /> Add mailbox
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid gap-3">
          {archivedCount > 0 && (
            <Label className="flex w-fit items-center gap-2 text-sm font-normal text-muted-foreground">
              <Checkbox checked={showArchived} onCheckedChange={(on) => setShowArchived(on === true)} />
              Show archived ({archivedCount})
            </Label>
          )}
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">Mailbox</TableHead>
                  <TableHead>Server</TableHead>
                  <TableHead>Sent today</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next send</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((m) => (
                  <TableRow key={m.id} className={cn(m.archived_at && "text-muted-foreground")}>
                    <TableCell className="pl-4">
                      <div className="grid leading-tight">
                        <span className="font-medium">{m.display_name}</span>
                        <span className="text-xs text-muted-foreground">{m.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.smtp_host}:{m.smtp_port} · {SECURITY_LABEL[m.smtp_security]}
                      <span className="block text-xs">
                        {m.imap_host ? `Sent copy: ${m.sent_folder ?? `via ${m.imap_host}`}` : "No Sent copy"}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {m.sent_today} / {m.daily_cap}
                    </TableCell>
                    <TableCell>
                      {m.archived_at ? (
                        <StatusBadge tone="muted">Archived</StatusBadge>
                      ) : m.status === "ERROR" && m.last_error ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <StatusBadge tone={MAILBOX_STATUS[m.status].tone}>{MAILBOX_STATUS[m.status].label}</StatusBadge>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">{m.last_error}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <StatusBadge tone={MAILBOX_STATUS[m.status].tone}>{MAILBOX_STATUS[m.status].label}</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.status === "ACTIVE" && m.next_send_at && new Date(m.next_send_at) > new Date()
                        ? formatRelative(m.next_send_at)
                        : "—"}
                    </TableCell>
                    <TableCell className="pr-2 text-right">
                      {editable && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.email}`}>
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-52">
                            {m.archived_at ? (
                              <DropdownMenuItem onSelect={() => archive.mutate({ m, restore: true })}>
                                Restore
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem onSelect={() => check.mutate(m)}>Test connection</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDialog({ mailbox: m })}>Edit</DropdownMenuItem>
                                {m.status === "ACTIVE" ? (
                                  <DropdownMenuItem onSelect={() => setStatus.mutate({ m, status: "PAUSED" })}>
                                    Pause
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => setStatus.mutate({ m, status: "ACTIVE" })}>
                                    {m.status === "ERROR" ? "Test and reactivate" : "Test and activate"}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {m.can_delete ? (
                                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(m)}>
                                    Delete
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => setArchiving(m)}>Archive</DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <MailboxDialog
        state={dialog}
        onOpenChange={(open) => !open && setDialog(null)}
        onSaved={() => {
          setDialog(null);
          refresh();
        }}
        onChanged={refresh}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              It has never sent an email, so it can be removed completely, along with its saved password.
              Draft or finished campaigns that listed it stop using it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleting) remove.mutate(deleting);
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!archiving} onOpenChange={(open) => !open && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiving?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This mailbox has sent emails or is part of a running campaign, so its history has to be kept and it
              can&apos;t be deleted. Archiving hides it, stops it sending (other mailboxes carry on) and removes it
              from draft campaigns. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiving) archive.mutate({ m: archiving, restore: false });
                setArchiving(null);
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
