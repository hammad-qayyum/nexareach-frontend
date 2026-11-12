"use client";

import { useQuery } from "@tanstack/react-query";
import { MegaphoneIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Campaign, unwrap } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { canEdit, useCurrentUser } from "@/lib/session";
import { CampaignStatusBadge } from "./campaign-status";

export function doneShare(c: Campaign) {
  const { total, waiting, sending } = c.counts;
  return total ? Math.round(((total - waiting - sending) / total) * 100) : 0;
}

export function CampaignsView() {
  const me = useCurrentUser();
  const router = useRouter();
  const campaigns = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(api.GET("/api/campaigns")),
    refetchInterval: 15_000,
  });

  const newButton = canEdit(me.role) && (
    <Button asChild>
      <Link href="/campaigns/new">
        <PlusIcon data-icon="inline-start" /> New campaign
      </Link>
    </Button>
  );

  return (
    <div className="grid gap-6">
      <PageHeader title="Campaigns" description="Write an email once, send it to a group, and follow its progress." actions={newButton} />
      {campaigns.error ? (
        <QueryError error={campaigns.error} onRetry={() => campaigns.refetch()} />
      ) : campaigns.isPending ? (
        <Skeleton className="h-40" />
      ) : campaigns.data.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MegaphoneIcon />
            </EmptyMedia>
            <EmptyTitle>No campaigns yet</EmptyTitle>
            <EmptyDescription>Import a CSV of leads, add a mailbox, then write your first campaign.</EmptyDescription>
          </EmptyHeader>
          {newButton && <EmptyContent>{newButton}</EmptyContent>}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-56">Progress</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.data.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/campaigns/${c.id}`)}>
                  <TableCell className="pl-4">
                    <div className="grid leading-tight">
                      <Link href={`/campaigns/${c.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">{c.groups.map((g) => g.name).join(", ") || "No groups"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>
                    {c.status === "DRAFT" ? (
                      <span className="text-muted-foreground">Not started</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Progress value={doneShare(c)} className="h-1.5" />
                        <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{doneShare(c)}%</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.counts.sent.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.counts.failed.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
