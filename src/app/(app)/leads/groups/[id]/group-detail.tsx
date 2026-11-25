"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, MegaphoneIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { SearchableSelect } from "@/components/searchable-select";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Lead, unwrap } from "@/lib/api/client";
import { dealsReason } from "@/lib/deals";
import { formatDate } from "@/lib/format";
import { PROVIDER_HINTS, PROVIDER_ORDER, type Provider, providerLabel } from "@/lib/providers";
import { canEdit, isAdmin, useCurrentUser } from "@/lib/session";
import { ProviderMix } from "../../import/provider-mix";
import { BUILT_IN, ColumnsMenu, ExtraFieldHeading, extraId, useHiddenColumns } from "./lead-columns";
import { AddLeadDialog, EditLeadDialog, exportPerson, ForgetPersonDialog, RenameGroupDialog } from "./lead-dialogs";

const PAGE_SIZE = 50;
const ALL = "__all__";

export function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const groupId = Number(id);
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState<Provider | "">("");
  const [country, setCountry] = useState("");
  // Deals' do-not-email list: "" = everyone, else only blocked people or only the others.
  const [dealsFilter, setDealsFilter] = useState<"" | "blocked" | "clear">("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [forgetting, setForgetting] = useState<Lead | null>(null);
  const { hidden, setShown } = useHiddenColumns();

  const group = useQuery({
    queryKey: ["groups", groupId],
    queryFn: () => unwrap(api.GET("/api/groups/{group_id}", { params: { path: { group_id: groupId } } })),
  });
  const facets = useQuery({
    queryKey: ["groups", groupId, "facets"],
    queryFn: () => unwrap(api.GET("/api/groups/{group_id}/facets", { params: { path: { group_id: groupId } } })),
  });
  const leads = useQuery({
    queryKey: ["groups", groupId, "leads", q, provider, country, dealsFilter, page],
    queryFn: () =>
      unwrap(
        api.GET("/api/groups/{group_id}/leads", {
          params: {
            path: { group_id: groupId },
            query: {
              q: q || undefined,
              provider: provider || undefined,
              country: country || undefined,
              deals_blocked: dealsFilter ? dealsFilter === "blocked" : undefined,
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

  const recheck = useMutation({
    mutationFn: () =>
      unwrap(api.POST("/api/groups/{group_id}/recheck-providers", { params: { path: { group_id: groupId } } })),
    onSuccess: (r) => {
      toast.success(
        `Checked ${r.checked.toLocaleString()} leads. ` +
          (r.changed ? `${r.changed.toLocaleString()} got a new provider.` : "Nothing changed."),
      );
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  if (group.error) return <QueryError error={group.error} onRetry={() => group.refetch()} />;

  // Every extra field in the group (not just on this page), so columns don't come and go between pages.
  const extraKeys = facets.data?.custom_keys ?? [...new Set((leads.data?.items ?? []).flatMap((l) => Object.keys(l.custom)))].sort();
  const shownExtra = extraKeys.filter((k) => !hidden.has(extraId(k)));
  const show = Object.fromEntries(BUILT_IN.map((c) => [c.id, !hidden.has(c.id)])) as Record<(typeof BUILT_IN)[number]["id"], boolean>;
  const mix = Object.fromEntries((facets.data?.providers ?? []).map((f) => [f.value, f.count]));
  const providerOptions = PROVIDER_ORDER.filter((p) => p !== "PENDING" && (mix[p] || p === provider));
  const filtered = Boolean(q || provider || country || dealsFilter);
  // Only while the Deals check is switched on.
  const dealsBlocked = facets.data?.deals_blocked;
  const columns = 2 + Object.values(show).filter(Boolean).length + shownExtra.length + (editable ? 1 : 0);

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
            `${group.data.lead_count.toLocaleString()} leads · imported ${formatDate(group.data.created_at)} · source: ${group.data.source ?? "unknown"}`
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
        <div className="flex max-w-3xl flex-wrap items-end gap-x-6 gap-y-2">
          <div className="max-w-xl min-w-0 flex-1 basis-80">
            <ProviderMix mix={mix} />
          </div>
          {editable && (
            <Button variant="outline" size="sm" onClick={() => recheck.mutate()} disabled={recheck.isPending}>
              <RefreshCwIcon data-icon="inline-start" className={recheck.isPending ? "animate-spin" : undefined} />
              {recheck.isPending ? "Checking… big groups take a minute" : "Recheck providers"}
            </Button>
          )}
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
        <SearchableSelect
          className="w-44"
          label="Filter by email provider"
          searchLabel="Search providers"
          value={provider || ALL}
          onValueChange={(v) => {
            setProvider(v === ALL ? "" : (v as Provider));
            setPage(1);
          }}
          options={[
            { value: ALL, label: "All providers", divider: true },
            ...providerOptions.map((p) => ({ value: p, label: providerLabel(p), hint: String(mix[p] ?? 0) })),
          ]}
        />
        <SearchableSelect
          className="w-44"
          label="Filter by country"
          searchLabel="Search countries"
          value={country || ALL}
          onValueChange={(v) => {
            setCountry(v === ALL ? "" : v);
            setPage(1);
          }}
          options={[
            { value: ALL, label: "All countries", divider: true },
            ...(facets.data?.countries ?? []).map((c) => ({ value: c.value, label: c.value, hint: String(c.count) })),
          ]}
        />
        {dealsBlocked != null && (
          <SearchableSelect
            className="w-48"
            label="Filter by the Deals do-not-email list"
            value={dealsFilter || ALL}
            onValueChange={(v) => {
              setDealsFilter(v === ALL ? "" : (v as "blocked" | "clear"));
              setPage(1);
            }}
            options={[
              { value: ALL, label: "Everyone", divider: true },
              { value: "blocked", label: "Blocked by Deals", hint: String(dealsBlocked) },
              { value: "clear", label: "Not blocked" },
            ]}
          />
        )}
        <div className="sm:ml-auto">
          <ColumnsMenu extraKeys={extraKeys} hidden={hidden} setShown={setShown} />
        </div>
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
                  {show.company && <TableHead>Company</TableHead>}
                  {show.country && <TableHead>Country</TableHead>}
                  {show.timezone && <TableHead>Timezone</TableHead>}
                  {show.provider && <TableHead>Provider</TableHead>}
                  {shownExtra.map((k) => (
                    <TableHead key={k}>
                      <ExtraFieldHeading fieldKey={k} />
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
                      <TableCell className="pl-4">
                        <span className="flex flex-wrap items-center gap-2">
                          {lead.email}
                          {lead.deals_block && (
                            <StatusBadge tone="bad">
                              Blocked by Deals: {dealsReason(lead.deals_block.reason, lead.deals_block.until, true)}
                            </StatusBadge>
                          )}
                          {lead.handed_to_deals_at &&
                            (lead.deals_lead_url ? (
                              <a href={lead.deals_lead_url} target="_blank" rel="noreferrer" title="Open in Deals">
                                <StatusBadge tone="info">In Deals</StatusBadge>
                              </a>
                            ) : (
                              <StatusBadge tone="info">In Deals</StatusBadge>
                            ))}
                        </span>
                      </TableCell>
                      <TableCell>{[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                      {show.company && <TableCell>{lead.company ?? "—"}</TableCell>}
                      {show.country && <TableCell className="text-muted-foreground">{lead.country ?? "—"}</TableCell>}
                      {show.timezone && (
                        <TableCell className="text-muted-foreground">{lead.timezone?.replace("_", " ") ?? "—"}</TableCell>
                      )}
                      {show.provider && (
                        <TableCell className="text-muted-foreground" title={PROVIDER_HINTS[lead.email_provider ?? "PENDING"]}>
                          {lead.email_provider ? providerLabel(lead.email_provider) : "Not checked"}
                        </TableCell>
                      )}
                      {shownExtra.map((k) => (
                        <TableCell key={k} className="max-w-48 truncate text-muted-foreground" title={lead.custom[k] ? String(lead.custom[k]) : undefined}>
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
                              <DropdownMenuItem
                                onSelect={() =>
                                  exportPerson(lead.email).then(
                                    () => toast.success(`Downloaded everything held about ${lead.email}.`),
                                    (e: Error) => toast.error(e.message),
                                  )
                                }
                              >
                                Download their data
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate(lead)}>
                                Remove from this group
                              </DropdownMenuItem>
                              {isAdmin(me.role) && (
                                <DropdownMenuItem variant="destructive" onSelect={() => setForgetting(lead)}>
                                  Forget this person…
                                </DropdownMenuItem>
                              )}
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
      <ForgetPersonDialog
        lead={forgetting}
        onOpenChange={(open) => !open && setForgetting(null)}
        onDone={() => {
          setForgetting(null);
          refresh();
          queryClient.invalidateQueries({ queryKey: ["duplicates"] });
          queryClient.invalidateQueries({ queryKey: ["campaigns"] });
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
