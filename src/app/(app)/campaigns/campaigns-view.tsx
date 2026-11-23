"use client";

import { useQuery } from "@tanstack/react-query";
import { MegaphoneIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { nameList, SearchBox, usePaged, useSearch } from "@/components/long-list";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Campaign, unwrap } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { canEdit, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CampaignStatusBadge } from "./campaign-status";

export function doneShare(c: Campaign) {
  const { total, waiting, sending } = c.counts;
  return total ? Math.round(((total - waiting - sending) / total) * 100) : 0;
}

const FILTERS = [
  { value: "all", label: "All", match: () => true },
  { value: "active", label: "Sending or paused", match: (c: Campaign) => c.status === "RUNNING" || c.status === "PAUSED" },
  { value: "draft", label: "Drafts", match: (c: Campaign) => c.status === "DRAFT" },
  { value: "done", label: "Finished", match: (c: Campaign) => c.status === "COMPLETED" || c.status === "CANCELLED" },
] as const;
const PAGE_SIZE = 25;

export function CampaignsView() {
  const me = useCurrentUser();
  const router = useRouter();
  const campaigns = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(api.GET("/api/campaigns")),
    refetchInterval: 15_000,
  });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const inFilter = (campaigns.data ?? []).filter(FILTERS.find((f) => f.value === filter)!.match);
  const search = useSearch(inFilter, (c) => `${c.name} ${c.groups.map((g) => g.name).join(" ")}`);
  const paged = usePaged(search.found, PAGE_SIZE);

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
        <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap gap-1" aria-label="Show">
            {FILTERS.map((f) => {
              const n = campaigns.data.filter(f.match).length;
              return (
                <Button
                  key={f.value}
                  size="sm"
                  variant={filter === f.value ? "secondary" : "ghost"}
                  aria-pressed={filter === f.value}
                  onClick={() => {
                    setFilter(f.value);
                    paged.setPage(1);
                  }}
                >
                  {f.label} <span className={cn("tabular-nums", filter !== f.value && "text-muted-foreground")}>{n.toLocaleString()}</span>
                </Button>
              );
            })}
          </nav>
          <SearchBox
            value={search.q}
            onChange={(q) => {
              search.setQ(q);
              paged.setPage(1);
            }}
            label="Search campaigns"
            className="w-full sm:ml-auto sm:w-64"
          />
        </div>
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
              {paged.shown.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No campaigns match.
                  </TableCell>
                </TableRow>
              )}
              {paged.shown.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/campaigns/${c.id}`)}>
                  <TableCell className="max-w-md pl-4 whitespace-normal">
                    <div className="grid leading-tight">
                      <Link href={`/campaigns/${c.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.name}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground" title={c.groups.map((g) => g.name).join(", ")}>
                        {nameList(c.groups.map((g) => g.name), 2) || "No groups"}
                      </span>
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
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {paged.total > PAGE_SIZE && <Pager page={paged.page} pageSize={PAGE_SIZE} total={paged.total} onPage={paged.setPage} />}
        </div>
      )}
    </div>
  );
}
