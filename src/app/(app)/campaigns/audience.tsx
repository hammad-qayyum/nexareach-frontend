"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Pager } from "@/components/pager";
import { QueryError } from "@/components/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Campaign, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { PROVIDER_LABELS } from "../leads/groups/[id]/lead-dialogs";

const PAGE_SIZE = 50;

/** Plan section 15, step 3: review the leads in the chosen groups and untick any to leave out. */
export function Audience({ campaign, editable }: { campaign: Campaign; editable: boolean }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const audience = useQuery({
    queryKey: ["campaigns", campaign.id, "audience", q, page],
    queryFn: () =>
      unwrap(
        api.GET("/api/campaigns/{campaign_id}/audience", {
          params: {
            path: { campaign_id: campaign.id },
            query: { q: q || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });

  const change = useMutation({
    mutationFn: (body: { lead_ids: number[]; excluded: boolean }) =>
      unwrap(
        api.PUT("/api/campaigns/{campaign_id}/exclusions", { params: { path: { campaign_id: campaign.id } }, body }),
      ),
    onSuccess: (r, body) => {
      toast.success(
        `${body.lead_ids.length} lead${body.lead_ids.length === 1 ? "" : "s"} ${body.excluded ? "left out" : "put back"}. ${r.excluded_count} left out in total.`,
      );
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaign.id] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (campaign.groups.length === 0) {
    return <p className="text-sm text-muted-foreground">Choose at least one lead group in the Edit tab first.</p>;
  }
  if (audience.error) return <QueryError error={audience.error} onRetry={() => audience.refetch()} />;
  const items = audience.data?.items ?? [];
  const total = audience.data?.total ?? 0;
  const allOnPage = items.length > 0 && items.every((l) => selected.has(l.id));

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {total.toLocaleString()} leads in {campaign.groups.map((g) => g.name).join(", ")}.{" "}
        {campaign.excluded_count > 0
          ? `${campaign.excluded_count} left out, so up to ${(total - campaign.excluded_count).toLocaleString()} will be emailed.`
          : "Everyone will be emailed unless you leave some out."}{" "}
        People on the do-not-contact list or emailed in the last 30 days are skipped automatically when you start.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search leads"
            className="pl-8"
            aria-label="Search leads"
          />
        </div>
        {editable && selected.size > 0 && (
          <>
            <Button
              variant="outline"
              disabled={change.isPending}
              onClick={() => change.mutate({ lead_ids: [...selected], excluded: true })}
            >
              Leave out {selected.size}
            </Button>
            <Button
              variant="ghost"
              disabled={change.isPending}
              onClick={() => change.mutate({ lead_ids: [...selected], excluded: false })}
            >
              Put back {selected.size}
            </Button>
          </>
        )}
      </div>
      {audience.isPending ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {editable && (
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        aria-label="Select all on this page"
                        checked={allOnPage}
                        onCheckedChange={(on) =>
                          setSelected((s) => {
                            const next = new Set(s);
                            for (const l of items) {
                              if (on === true) next.add(l.id);
                              else next.delete(l.id);
                            }
                            return next;
                          })
                        }
                      />
                    </TableHead>
                  )}
                  <TableHead className={cn(!editable && "pl-4")}>Lead</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Local time</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="pr-4">Will be emailed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((l) => (
                  <TableRow key={l.id} className={cn(l.excluded && "text-muted-foreground")}>
                    {editable && (
                      <TableCell className="pl-4">
                        <Checkbox
                          aria-label={`Select ${l.email}`}
                          checked={selected.has(l.id)}
                          onCheckedChange={(on) =>
                            setSelected((s) => {
                              const next = new Set(s);
                              if (on === true) next.add(l.id);
                              else next.delete(l.id);
                              return next;
                            })
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell className={cn(!editable && "pl-4")}>
                      <div className="grid leading-tight">
                        <span className={cn(l.excluded && "line-through")}>{l.email}</span>
                        <span className="text-xs text-muted-foreground">
                          {[l.name, l.company].filter(Boolean).join(" · ") || " "}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{l.country ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{l.timezone?.replace("_", " ") ?? "Campaign's"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.email_provider ? PROVIDER_LABELS[l.email_provider] : "—"}
                    </TableCell>
                    <TableCell className="pr-4">
                      {l.excluded ? <Badge variant="outline">Left out</Badge> : <span className="text-sm">Yes</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
