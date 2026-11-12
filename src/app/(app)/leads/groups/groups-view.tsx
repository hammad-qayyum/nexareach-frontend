"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontalIcon, UploadIcon, UsersRoundIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Group, unwrap } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { canEdit, useCurrentUser } from "@/lib/session";

export const GROUPS_QUERY_KEY = ["groups"] as const;

export function GroupsView() {
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<Group | null>(null);
  const groups = useQuery({ queryKey: GROUPS_QUERY_KEY, queryFn: () => unwrap(api.GET("/api/groups")) });

  const remove = useMutation({
    mutationFn: (g: Group) => unwrap(api.DELETE("/api/groups/{group_id}", { params: { path: { group_id: g.id } } })),
    onSuccess: () => {
      toast.success("Group deleted. Its leads stay in the system.");
      queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY });
    },
    onError: (e) => toast.error(e.message),
  });

  const importButton = editable && (
    <Button asChild>
      <Link href="/leads/import">
        <UploadIcon data-icon="inline-start" /> Import CSV
      </Link>
    </Button>
  );

  return (
    <div className="grid gap-6">
      <PageHeader title="Groups" description="Each import becomes a group. Campaigns send to one or more groups." actions={importButton} />
      {groups.error ? (
        <QueryError error={groups.error} onRetry={() => groups.refetch()} />
      ) : groups.isPending ? (
        <Skeleton className="h-40" />
      ) : groups.data.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersRoundIcon />
            </EmptyMedia>
            <EmptyTitle>No groups yet</EmptyTitle>
            <EmptyDescription>Import a CSV of leads to create the first group.</EmptyDescription>
          </EmptyHeader>
          {importButton && <EmptyContent>{importButton}</EmptyContent>}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Group</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead>Duplicates</TableHead>
                <TableHead>Imported</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.data.map((g) => (
                <TableRow key={g.id} className="cursor-pointer" onClick={() => router.push(`/leads/groups/${g.id}`)}>
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/leads/groups/${g.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                      {g.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{g.source ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.lead_count.toLocaleString()}</TableCell>
                  <TableCell>
                    {g.pending_count > 0 ? (
                      <Link
                        href="/leads/duplicates"
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium underline underline-offset-4"
                      >
                        {g.pending_count.toLocaleString()} to review
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(g.created_at)}</TableCell>
                  <TableCell className="pr-2 text-right" onClick={(e) => e.stopPropagation()}>
                    {editable && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${g.name}`}>
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-44">
                          <DropdownMenuItem asChild>
                            <Link href={`/campaigns/new?group=${g.id}`}>New campaign</Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(g)}>
                            Delete group
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

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              The group goes, but its leads stay in the system. Groups already used by a campaign can&apos;t be
              deleted.
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
