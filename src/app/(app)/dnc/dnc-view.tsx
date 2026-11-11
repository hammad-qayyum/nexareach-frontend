"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { QueryError } from "@/components/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, unwrap } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { canEdit, useCurrentUser } from "@/lib/session";

const PAGE_SIZE = 50;

export function DncView() {
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState("");
  const [reason, setReason] = useState("");

  const list = useQuery({
    queryKey: ["dnc", q, page],
    queryFn: () =>
      unwrap(
        api.GET("/api/dnc", {
          params: { query: { q: q || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["dnc"] });

  const add = useMutation({
    mutationFn: () => unwrap(api.POST("/api/dnc", { body: { entries, reason: reason || null } })),
    onSuccess: (r) => {
      const parts = [`Added ${r.added}`];
      if (r.already_listed) parts.push(`${r.already_listed} already listed`);
      if (r.invalid.length) parts.push(`${r.invalid.length} not valid: ${r.invalid.slice(0, 3).join(", ")}`);
      (r.invalid.length ? toast.warning : toast.success)(`${parts.join(" · ")}.`);
      setEntries("");
      setReason("");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => unwrap(api.DELETE("/api/dnc/{dnc_id}", { params: { path: { dnc_id: id } } })),
    onSuccess: () => {
      toast.success("Removed from the list.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Do not contact"
        description="People and domains that must never be emailed. Campaigns skip them, even mid-send."
      />

      {editable && (
        <Card>
          <CardHeader>
            <CardTitle>Add to the list</CardTitle>
            <CardDescription>
              One per line. An email address blocks that person; a domain such as acme.com blocks everyone there.
              Add anyone who replies asking not to be emailed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate();
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="dnc-entries">Emails or domains</FieldLabel>
                  <Textarea
                    id="dnc-entries"
                    value={entries}
                    onChange={(e) => setEntries(e.target.value)}
                    rows={3}
                    placeholder={"sara@acme.com\ncompetitor.com"}
                    required
                  />
                </Field>
                <div className="flex flex-wrap items-end gap-3">
                  <Field className="min-w-60 flex-1">
                    <FieldLabel htmlFor="dnc-reason">Reason (optional)</FieldLabel>
                    <Input
                      id="dnc-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={500}
                      placeholder="Replied asking to stop"
                    />
                  </Field>
                  <Button type="submit" disabled={add.isPending || !entries.trim()}>
                    {add.isPending ? "Adding…" : "Add"}
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        <div className="relative max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search the list"
            className="pl-8"
            aria-label="Search the list"
          />
        </div>
        {list.error ? (
          <QueryError error={list.error} onRetry={() => list.refetch()} />
        ) : list.isPending ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-4">Email or domain</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Remove</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.items.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                        {q ? "Nothing matches that search." : "The list is empty."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.data.items.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="pl-4">
                          <span className="font-mono text-xs">{entry.value}</span>
                          {entry.kind === "DOMAIN" && (
                            <Badge variant="secondary" className="ml-2 font-normal">
                              whole domain
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{entry.reason ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(entry.created_at)}</TableCell>
                        <TableCell className="pr-2 text-right">
                          {editable && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${entry.value}`}
                              onClick={() => remove.mutate(entry.id)}
                            >
                              <XIcon />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <Pager page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
