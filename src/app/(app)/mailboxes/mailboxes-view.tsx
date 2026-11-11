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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, type Mailbox, type MailboxStatus, unwrap } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import { canEdit, useCurrentUser } from "@/lib/session";
import { MailboxDialog } from "./mailbox-dialog";

export const MAILBOXES_QUERY_KEY = ["mailboxes"] as const;

const STATUS: Record<MailboxStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "good" },
  PAUSED: { label: "Paused", tone: "muted" },
  ERROR: { label: "Login failed", tone: "bad" },
};

const SECURITY_LABEL = { SSL: "SSL", STARTTLS: "STARTTLS", NONE: "No encryption" } as const;

export function MailboxesView() {
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ mailbox: Mailbox | null } | null>(null);
  const [deleting, setDeleting] = useState<Mailbox | null>(null);

  const mailboxes = useQuery({
    queryKey: MAILBOXES_QUERY_KEY,
    queryFn: () => unwrap(api.GET("/api/mailboxes")),
    refetchInterval: 30_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: MAILBOXES_QUERY_KEY });

  const check = useMutation({
    mutationFn: (m: Mailbox) =>
      unwrap(api.POST("/api/mailboxes/{mailbox_id}/check", { params: { path: { mailbox_id: m.id } } })),
    onSuccess: (result, m) =>
      result.ok ? toast.success(`${m.email}: ${result.detail}`) : toast.error(`${m.email}: ${result.detail}`),
    onError: (e) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: ({ m, status }: { m: Mailbox; status: MailboxStatus }) =>
      unwrap(api.PATCH("/api/mailboxes/{mailbox_id}", { params: { path: { mailbox_id: m.id } }, body: { status } })),
    onSuccess: (m) => {
      toast.success(`${m.email} is now ${STATUS[m.status].label.toLowerCase()}.`);
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
      ) : mailboxes.data.length === 0 ? (
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
              {mailboxes.data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-4">
                    <div className="grid leading-tight">
                      <span className="font-medium">{m.display_name}</span>
                      <span className="text-xs text-muted-foreground">{m.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.smtp_host}:{m.smtp_port} · {SECURITY_LABEL[m.smtp_security]}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {m.sent_today} / {m.daily_cap}
                  </TableCell>
                  <TableCell>
                    {m.status === "ERROR" && m.last_error ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <StatusBadge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</StatusBadge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{m.last_error}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <StatusBadge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</StatusBadge>
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
                        <DropdownMenuContent align="end" className="min-w-44">
                          <DropdownMenuItem onSelect={() => check.mutate(m)}>Test connection</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDialog({ mailbox: m })}>Edit</DropdownMenuItem>
                          {m.status === "ACTIVE" ? (
                            <DropdownMenuItem onSelect={() => setStatus.mutate({ m, status: "PAUSED" })}>
                              Pause
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => setStatus.mutate({ m, status: "ACTIVE" })}>
                              {m.status === "ERROR" ? "Reactivate (login fixed)" : "Activate"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(m)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MailboxDialog
        state={dialog}
        onOpenChange={(open) => !open && setDialog(null)}
        onSaved={() => {
          setDialog(null);
          refresh();
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only mailboxes that have never been used in a campaign can be deleted. Its saved password is
              removed too.
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
    </div>
  );
}
