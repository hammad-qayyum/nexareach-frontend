"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, MegaphoneIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Lead, unwrap } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { canEdit, useCurrentUser } from "@/lib/session";
import { ProviderMix } from "../../import/provider-mix";
import { AddLeadDialog, EditLeadDialog, PROVIDER_LABELS, RenameGroupDialog } from "./lead-dialogs";

const PAGE_SIZE = 50;
const ALL = "__all__";
type Provider = NonNullable<Lead["email_provider"]>;

export function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const groupId = Number(id);
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState<Provider | "">("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);

  const group = useQuery({
    queryKey: ["groups", groupId],
    queryFn: () => unwrap(api.GET("/api/groups/{group_id}", { params: { path: { group_id: groupId } } })),
  });
  const facets = useQuery({
    queryKey: ["groups", groupId, "facets"],
    queryFn: () => unwrap(api.GET("/api/groups/{group_id}/facets", { params: { path: { group_id: groupId } } })),
  });
  const leads = useQuery({
    queryKey: ["groups", groupId, "leads", q, provider, country, page],
    queryFn: () =>
      unwrap(
        api.GET("/api/groups/{group_id}/leads", {
          params: {
            path: { group_id: groupId },
            query: {
              q: q || undefined,
              provider: provider || undefined,
              country: country || undefined,
              limit: PAGE_SIZE,
              offset: (page - 1) * PAGE_SIZE,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["groups"] });

  const remove = useMutation({
    mutationFn: (lead: Lead) =>
      unwrap(
        api.DELETE("/api/groups/{group_id}/leads/{lead_id}", {
          params: { path: { group_id: groupId, lead_id: lead.id } },
        }),
      ),
    onSuccess: (_, lead) => {
      toast.success(`${lead.email} removed from this group. It stays in the system and its other groups.`);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  if (group.error) return <QueryError error={group.error} onRetry={() => group.refetch()} />;

  const customKeys = [...new Set((leads.data?.items ?? []).flatMap((l) => Object.keys(l.custom)))].slice(0, 2);
  const mix = Object.fromEntries((facets.data?.providers ?? []).map((f) => [f.value, f.count]));
  const filtered = Boolean(q || provider || country);
  const columns = 6 + customKeys.length + (editable ? 1 : 0);

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
            editable && (
              <>
                <Button variant="ghost" onClick={() => setRenaming(true)} disabled={!group.data}>
                  <PencilIcon data-icon="inline-start" /> Rename
                </Button>
                <Button variant="outline" onClick={() => setAdding(true)}>
                  <PlusIcon data-icon="inline-start" /> Add lead
                </Button>
                <Button asChild>
                  <Link href={`/campaigns/new?group=${groupId}`}>
                    <MegaphoneIcon data-icon="inline-start" /> New campaign
                  </Link>
                </Button>
              </>
            )
          }
        />
      </div>

      {group.data && group.data.pending_count > 0 && (
        <p className="text-sm text-muted-foreground">
          {group.data.pending_count.toLocaleString()} more row{group.data.pending_count === 1 ? " is" : "s are"} waiting as
          duplicates and aren&apos;t in this group yet.{" "}
          <Link href="/leads/duplicates" className="font-medium text-primary underline-offset-4 hover:underline">
            Review duplicates
          </Link>
        </p>
      )}

      {Object.keys(mix).length > 0 && (
        <div className="max-w-xl">
          <ProviderMix mix={mix} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
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
        <Select
          value={provider || ALL}
          onValueChange={(v) => {
            setProvider(v === ALL ? "" : (v as Provider));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by email provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All providers</SelectItem>
            <SelectSeparator />
            {(["GOOGLE", "MICROSOFT", "OTHER", "UNKNOWN"] as const).map((p) => (
              <SelectItem key={p} value={p}>
                {PROVIDER_LABELS[p]}
                {mix[p] ? ` (${mix[p]})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={country || ALL}
          onValueChange={(v) => {
            setCountry(v === ALL ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by country">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All countries</SelectItem>
            <SelectSeparator />
            {(facets.data?.countries ?? []).map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.value} ({c.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                  <TableHead>Timezone</TableHead>
                  <TableHead>Provider</TableHead>
                  {customKeys.map((k) => (
                    <TableHead key={k} className="font-mono text-xs">
                      {k}
                    </TableHead>
                  ))}
                  {editable && (
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.data.items.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns} className="py-10 text-center text-muted-foreground">
                      {filtered ? "No leads match these filters." : "This group has no leads yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.data.items.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="pl-4">{lead.email}</TableCell>
                      <TableCell>{[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                      <TableCell>{lead.company ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.country ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.timezone?.replace("_", " ") ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.email_provider ? PROVIDER_LABELS[lead.email_provider] : "—"}
                      </TableCell>
                      {customKeys.map((k) => (
                        <TableCell key={k} className="max-w-40 truncate text-muted-foreground">
                          {String(lead.custom[k] ?? "—")}
                        </TableCell>
                      ))}
                      {editable && (
                        <TableCell className="pr-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${lead.email}`}>
                                <MoreHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-44">
                              <DropdownMenuItem onSelect={() => setEditing(lead)}>Edit details</DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate(lead)}>
                                Remove from this group
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={leads.data.total} onPage={setPage} />
        </div>
      )}

      <AddLeadDialog
        groupId={groupId}
        open={adding}
        onOpenChange={setAdding}
        onDone={() => {
          setAdding(false);
          refresh();
          queryClient.invalidateQueries({ queryKey: ["duplicates"] });
        }}
      />
      <EditLeadDialog
        lead={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onDone={() => {
          setEditing(null);
          refresh();
        }}
      />
      {group.data && (
        <RenameGroupDialog
          group={group.data}
          open={renaming}
          onOpenChange={setRenaming}
          onDone={() => {
            setRenaming(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
