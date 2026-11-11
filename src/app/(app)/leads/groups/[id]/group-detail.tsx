"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, MegaphoneIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, unwrap } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { canEdit, useCurrentUser } from "@/lib/session";

const PAGE_SIZE = 50;

export function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const groupId = Number(id);
  const me = useCurrentUser();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const group = useQuery({
    queryKey: ["groups", groupId],
    queryFn: () => unwrap(api.GET("/api/groups/{group_id}", { params: { path: { group_id: groupId } } })),
  });
  const leads = useQuery({
    queryKey: ["groups", groupId, "leads", q, page],
    queryFn: () =>
      unwrap(
        api.GET("/api/groups/{group_id}/leads", {
          params: {
            path: { group_id: groupId },
            query: { q: q || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });

  if (group.error) return <QueryError error={group.error} onRetry={() => group.refetch()} />;

  const customKeys = [...new Set((leads.data?.items ?? []).flatMap((l) => Object.keys(l.custom)))].slice(0, 3);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/leads/groups">
            <ArrowLeftIcon data-icon="inline-start" /> Groups
          </Link>
        </Button>
        <PageHeader
          title={group.data?.name ?? "Group"}
          description={
            group.data &&
            `${group.data.lead_count.toLocaleString()} leads · imported ${formatDate(group.data.created_at)}${group.data.source ? ` · ${group.data.source}` : ""}`
          }
          actions={
            canEdit(me.role) && (
              <Button asChild>
                <Link href={`/campaigns/new?group=${groupId}`}>
                  <MegaphoneIcon data-icon="inline-start" /> New campaign
                </Link>
              </Button>
            )
          }
        />
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search by email, name or company"
          className="pl-8"
          aria-label="Search leads"
        />
      </div>

      {leads.error ? (
        <QueryError error={leads.error} onRetry={() => leads.refetch()} />
      ) : leads.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid gap-3">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Country</TableHead>
                  {customKeys.map((k) => (
                    <TableHead key={k} className="font-mono text-xs">
                      {k}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.data.items.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4 + customKeys.length} className="py-10 text-center text-muted-foreground">
                      No leads match that search.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.data.items.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="pl-4">{lead.email}</TableCell>
                      <TableCell>{[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                      <TableCell>{lead.company ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.country ?? "—"}</TableCell>
                      {customKeys.map((k) => (
                        <TableCell key={k} className="max-w-48 truncate text-muted-foreground">
                          {String(lead.custom[k] ?? "—")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={leads.data.total} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
