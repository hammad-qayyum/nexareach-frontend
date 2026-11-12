"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { QueryError } from "@/components/query-error";
import { StatusBadge } from "@/components/status-dot";
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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type Duplicate, type DuplicateDecision, unwrap } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { canEdit, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const ALL = "__all__";

const DECISIONS: { value: DuplicateDecision; label: string; help: string }[] = [
  { value: "KEEP_NEW", label: "Keep new", help: "Update the existing lead with the new details" },
  { value: "KEEP_OLD", label: "Keep old", help: "Keep the existing details and add the lead to the new group" },
  { value: "KEEP_BOTH", label: "Keep both", help: "Create a second lead with the same email; each gets its own email" },
];

const DECIDED_LABEL: Record<Duplicate["status"], string> = {
  PENDING: "Pending",
  KEPT_NEW: "Kept new",
  KEPT_OLD: "Kept old",
  KEPT_BOTH: "Kept both",
};

const FIELDS = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["company", "Company"],
  ["country", "Country"],
] as const;

type Bulk = { decision: DuplicateDecision; scope: "selected" | "all" };

export function DuplicatesView() {
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const queryClient = useQueryClient();
  const [state, setState] = useState<"pending" | "decided">("pending");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<Bulk | null>(null);

  const groups = useQuery({ queryKey: ["groups"], queryFn: () => unwrap(api.GET("/api/groups")) });
  const list = useQuery({
    queryKey: ["duplicates", state, groupId, page],
    queryFn: () =>
      unwrap(
        api.GET("/api/duplicates", {
          params: {
            query: { status: state, group_id: groupId ?? undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });

  const resolve = useMutation({
    mutationFn: (body: { decision: DuplicateDecision; ids?: number[]; all_pending: boolean; group_id?: number | null }) =>
      unwrap(api.POST("/api/duplicates/resolve", { body })),
    onSuccess: (r, body) => {
      const label = DECISIONS.find((d) => d.value === body.decision)!.label.toLowerCase();
      toast.success(`${r.resolved.toLocaleString()} duplicate${r.resolved === 1 ? "" : "s"} decided: ${label}.`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pendingInView = state === "pending" ? total : 0;
  const allOnPage = items.length > 0 && items.every((d) => selected.has(d.id));
  const groupName = groups.data?.find((g) => g.id === groupId)?.name;

  function toggle(id: number, on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function runBulk(b: Bulk) {
    if (b.scope === "selected") resolve.mutate({ decision: b.decision, ids: [...selected], all_pending: false });
    else resolve.mutate({ decision: b.decision, all_pending: true, group_id: groupId });
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Duplicates"
        description="Imported rows whose email is already in the system, or repeated in the same file. They aren't emailed until you decide."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={state}
            onValueChange={(v) => {
              setState(v as "pending" | "decided");
              setPage(1);
              setSelected(new Set());
            }}
          >
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="decided">Decided</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select
            value={groupId ? String(groupId) : ALL}
            onValueChange={(v) => {
              setGroupId(v === ALL ? null : Number(v));
              setPage(1);
              setSelected(new Set());
            }}
          >
            <SelectTrigger className="w-56" aria-label="Filter by group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All groups</SelectItem>
              <SelectSeparator />
              {groups.data?.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.name}
                  {g.pending_count > 0 && ` (${g.pending_count} pending)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {editable && state === "pending" && pendingInView > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {selected.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Decide {selected.size} selected</Button>
                </DropdownMenuTrigger>
                <DecisionMenu onPick={(decision) => runBulk({ decision, scope: "selected" })} />
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  Decide all {pendingInView.toLocaleString()} pending{groupName ? ` in ${groupName}` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DecisionMenu onPick={(decision) => setConfirm({ decision, scope: "all" })} />
            </DropdownMenu>
          </div>
        )}
      </div>

      {list.error ? (
        <QueryError error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <Skeleton className="h-64" />
      ) : items.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CopyCheckIcon />
            </EmptyMedia>
            <EmptyTitle>{state === "pending" ? "Nothing to review" : "No decisions yet"}</EmptyTitle>
            <EmptyDescription>
              {state === "pending"
                ? "When an import contains an email that's already in the system, it waits here for you to decide."
                : "Duplicates you decide appear here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className={cn("grid gap-3 transition-opacity", list.isPlaceholderData && "opacity-60")}>
          {editable && state === "pending" && (
            <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={allOnPage}
                onCheckedChange={(on) =>
                  setSelected((s) => {
                    const next = new Set(s);
                    for (const d of items) {
                      if (on === true) next.add(d.id);
                      else next.delete(d.id);
                    }
                    return next;
                  })
                }
              />
              Select all on this page
            </label>
          )}
          {items.map((d) => (
            <DuplicateCard
              key={d.id}
              dup={d}
              editable={editable && state === "pending"}
              selected={selected.has(d.id)}
              onSelect={(on) => toggle(d.id, on)}
              busy={resolve.isPending}
              onDecide={(decision) => resolve.mutate({ decision, ids: [d.id], all_pending: false })}
            />
          ))}
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          {confirm && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {DECISIONS.find((d) => d.value === confirm.decision)!.label} for all {pendingInView.toLocaleString()} pending
                  {groupName ? ` in ${groupName}` : ""}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {DECISIONS.find((d) => d.value === confirm.decision)!.help}. Every decision is recorded in the activity
                  log and can&apos;t be undone here.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    runBulk(confirm);
                    setConfirm(null);
                  }}
                >
                  Apply to all
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DecisionMenu({ onPick }: { onPick: (d: DuplicateDecision) => void }) {
  return (
    <DropdownMenuContent align="end" className="w-80">
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Choose what to keep</DropdownMenuLabel>
      {DECISIONS.map((d) => (
        <DropdownMenuItem key={d.value} onSelect={() => onPick(d.value)} className="flex-col items-start gap-0.5">
          <span className="font-medium">{d.label}</span>
          <span className="text-xs text-muted-foreground">{d.help}</span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );
}

function DuplicateCard({
  dup,
  editable,
  selected,
  onSelect,
  busy,
  onDecide,
}: {
  dup: Duplicate;
  editable: boolean;
  selected: boolean;
  onSelect: (on: boolean) => void;
  busy: boolean;
  onDecide: (d: DuplicateDecision) => void;
}) {
  const different = new Set(dup.differences);
  const customKeys = [...new Set([...Object.keys(dup.existing.custom), ...Object.keys(dup.new.custom)])].sort();
  const rows: { key: string; label: string; old: unknown; new: unknown }[] = [
    ...FIELDS.map(([f, label]) => ({ key: f, label, old: dup.existing[f], new: dup.new[f] })),
    ...customKeys.map((k) => ({ key: `custom.${k}`, label: k, old: dup.existing.custom[k], new: dup.new.custom[k] })),
  ].filter((r) => r.old || r.new);

  return (
    <div className={cn("grid gap-3 rounded-lg border p-4", selected && "border-primary/60 bg-primary/5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {editable && (
            <Checkbox className="mt-0.5" checked={selected} onCheckedChange={(on) => onSelect(on === true)} aria-label={`Select ${dup.new.email}`} />
          )}
          <div className="grid leading-tight">
            <span className="font-medium">{dup.new.email}</span>
            <span className="text-xs text-muted-foreground">
              Row {dup.row_number} of the{" "}
              <Link href={`/leads/groups/${dup.group.id}`} className="underline-offset-4 hover:underline">
                {dup.group.name}
              </Link>{" "}
              import · {dup.differences.length === 0 ? "identical details" : `${dup.differences.length} field${dup.differences.length === 1 ? " differs" : "s differ"}`}
            </span>
          </div>
        </div>
        {editable ? (
          <div className="flex flex-wrap gap-1.5">
            {DECISIONS.map((d) => (
              <Button key={d.value} size="sm" variant="outline" title={d.help} disabled={busy} onClick={() => onDecide(d.value)}>
                {d.label}
              </Button>
            ))}
          </div>
        ) : (
          dup.status !== "PENDING" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge tone="good">{DECIDED_LABEL[dup.status]}</StatusBadge>
              {dup.decided_at && formatDateTime(dup.decided_at)}
            </div>
          )
        )}
      </div>

      {dup.status !== "PENDING" && (
        <p className="text-sm text-muted-foreground">
          {dup.status === "KEPT_BOTH"
            ? `A second lead with this email, holding the new row's details, was added to ${dup.group.name}. The original lead (below, left) is unchanged and stays in its own groups.`
            : dup.status === "KEPT_NEW"
              ? `The existing lead was updated with the new row's details and added to ${dup.group.name}.`
              : `The existing lead was kept as it was and added to ${dup.group.name}.`}
        </p>
      )}
      {rows.length > 0 ? (
        <table className="w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-md border text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-36 border-b px-3 py-2 font-medium">Field</th>
              <th className="border-b px-3 py-2 font-medium">Already in the system (since {formatDate(dup.existing.created_at)})</th>
              <th className="border-b px-3 py-2 font-medium">New row</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const diff = different.has(r.key);
              return (
                <tr key={r.key} className={cn("[&:not(:last-child)>td]:border-b", diff && "bg-warning/10")}>
                  <td className={cn("px-3 py-1.5 text-muted-foreground", r.key.startsWith("custom.") && "font-mono text-xs")}>{r.label}</td>
                  <td className="px-3 py-1.5 break-words">{(r.old as string) || <span className="text-muted-foreground">—</span>}</td>
                  <td className={cn("px-3 py-1.5 break-words", diff && "font-medium")}>
                    {(r.new as string) || <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">Neither row has any details besides the email address.</p>
      )}
    </div>
  );
}
