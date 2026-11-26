"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConicalIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Limited } from "@/components/long-list";
import { SearchableSelect } from "@/components/searchable-select";
import { QueryError } from "@/components/query-error";
import { StatusBadge } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PROVIDER_LABEL } from "@/app/(app)/warmup/helper-dialog";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { DELIVERABILITY_KEY, FOLDER } from "@/lib/deliverability";
import { formatDateTime } from "@/lib/format";

const TESTS_KEY = ["deliverability", "placement"] as const;
const LATEST = "__latest__";
const SAMPLE = "__sample__";

type Test = Schemas["PlacementTestOut"];

export function PlacementTab({
  mailboxes,
  setup,
  editable,
}: {
  mailboxes: Schemas["MailboxCard"][];
  setup: Schemas["SetupState"];
  editable: boolean;
}) {
  const [dialog, setDialog] = useState(false);
  const tests = useQuery({
    queryKey: TESTS_KEY,
    queryFn: () => unwrap(api.GET("/api/deliverability/placement")),
    // Results arrive over a few minutes while a test runs.
    refetchInterval: (q) => (q.state.data?.some((t) => t.status === "RUNNING") ? 15_000 : 60_000),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <CardTitle>Placement tests</CardTitle>
          <CardDescription>
            A campaign&apos;s real subject and message is sent from one mailbox to each of your{" "}
            <Link href="/warmup" className="underline underline-offset-4">
              helper accounts
            </Link>{" "}
            ({setup.helpers}). A few minutes later the app looks where it landed: Inbox, Gmail&apos;s Promotions tab, or
            Spam. Runs every Monday for mailboxes that sent campaign emails lately. Test emails count towards the
            mailbox&apos;s daily limit.
          </CardDescription>
        </div>
        {editable && (
          <Button onClick={() => setDialog(true)} disabled={!setup.helpers || !mailboxes.length}>
            <FlaskConicalIcon data-icon="inline-start" /> Run test
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {tests.error ? (
          <div className="px-6">
            <QueryError error={tests.error} onRetry={() => tests.refetch()} />
          </div>
        ) : tests.isPending ? (
          <Skeleton className="mx-6 h-40" />
        ) : tests.data.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">
            No tests yet.{setup.helpers ? "" : " Add a helper account on the Warm-up page first."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">When</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="pr-6">Where it landed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tests.data.map((t) => (
                <TestRow key={t.id} test={t} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {editable && <RunTestDialog open={dialog} onClose={() => setDialog(false)} mailboxes={mailboxes} />}
    </Card>
  );
}

function TestRow({ test: t }: { test: Test }) {
  return (
    <TableRow>
      <TableCell className="pl-6 align-top whitespace-nowrap">
        <div className="grid leading-tight">
          <span>{formatDateTime(t.created_at)}</span>
          <span className="text-xs text-muted-foreground">{t.requested_by ?? "Weekly schedule"}</span>
        </div>
      </TableCell>
      <TableCell className="align-top">{t.mailbox_email}</TableCell>
      <TableCell className="max-w-64 align-top">
        <div className="grid leading-tight">
          <span className="truncate" title={t.subject}>
            {t.subject}
          </span>
          <span className="text-xs text-muted-foreground">
            {t.campaign_name ? `Campaign: ${t.campaign_name}` : t.campaign_id ? "" : "Sample message"}
          </span>
        </div>
      </TableCell>
      <TableCell className="pr-6 align-top">
        {t.results.length > 4 && <FolderSummary results={t.results} />}
        <Limited items={t.results} limit={t.results.length > 4 ? 0 : 4} noun="helpers, one by one" buttonClassName="-ml-2 h-7">
        {(results) => (
        <ul className="grid gap-1">
          {results.map((r) => (
            <li key={r.helper_email} className="flex flex-wrap items-center gap-2 text-sm">
              {r.folder ? (
                <StatusBadge tone={FOLDER[r.folder].tone}>{FOLDER[r.folder].label}</StatusBadge>
              ) : r.state === "FAILED" ? (
                <StatusBadge tone="muted">Not tested</StatusBadge>
              ) : (
                <StatusBadge tone="info">{r.state === "WAITING" ? "Sending…" : "Looking…"}</StatusBadge>
              )}
              <span className="text-muted-foreground">
                {PROVIDER_LABEL[r.provider]} · {r.helper_email}
              </span>
              {r.error && <span className="w-full text-xs text-destructive">{r.error}</span>}
            </li>
          ))}
        </ul>
        )}
        </Limited>
      </TableCell>
    </TableRow>
  );
}

/** "32 Inbox · 5 Promotions · 3 Spam" for a test sent to many helpers. */
function FolderSummary({ results }: { results: Test["results"] }) {
  const counts = new Map<string, { n: number; tone: Parameters<typeof StatusBadge>[0]["tone"] }>();
  for (const r of results) {
    const key = r.folder ? FOLDER[r.folder].label : r.state === "FAILED" ? "Not tested" : "Waiting";
    const tone = r.folder ? FOLDER[r.folder].tone : r.state === "FAILED" ? "muted" : "info";
    counts.set(key, { n: (counts.get(key)?.n ?? 0) + 1, tone });
  }
  return (
    <div className="mb-1 flex flex-wrap gap-1.5">
      {[...counts].map(([label, { n, tone }]) => (
        <StatusBadge key={label} tone={tone}>
          {n} {label}
        </StatusBadge>
      ))}
    </div>
  );
}

function RunTestDialog({
  open,
  onClose,
  mailboxes,
}: {
  open: boolean;
  onClose: () => void;
  mailboxes: Schemas["MailboxCard"][];
}) {
  const queryClient = useQueryClient();
  const usable = mailboxes.filter((m) => m.status !== "ERROR");
  const [mailboxId, setMailboxId] = useState<string>("");
  const [message, setMessage] = useState<string>(LATEST);
  const chosen = mailboxId || (usable[0] ? String(usable[0].id) : "");
  const campaigns = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(api.GET("/api/campaigns")),
    enabled: open,
  });
  const forMailbox = (campaigns.data ?? []).filter(
    (c) => c.subject.trim() && c.mailboxes.some((m) => String(m.id) === chosen),
  );
  const start = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/deliverability/placement", {
          body: {
            mailbox_id: Number(chosen),
            campaign_id: message !== LATEST && message !== SAMPLE ? Number(message) : null,
            use_sample: message === SAMPLE,
          },
        }),
      ),
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: TESTS_KEY });
      queryClient.invalidateQueries({ queryKey: DELIVERABILITY_KEY });
      toast.success(`Test started: ${t.results.length} emails go out within a minute. Results in about 5 minutes.`);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run a placement test</DialogTitle>
          <DialogDescription>
            One email to each working helper account, from the mailbox you choose. Personal fields use the helper&apos;s
            name, others their fallbacks.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="placement-mailbox">From</Label>
            <SearchableSelect
              id="placement-mailbox"
              className="w-full"
              placeholder="Choose a mailbox"
              searchLabel="Search mailboxes"
              value={chosen}
              onValueChange={(v) => {
                setMailboxId(v);
                setMessage(LATEST);
              }}
              options={usable.map((m) => ({ value: String(m.id), label: m.email }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="placement-message">Message</Label>
            <SearchableSelect
              id="placement-message"
              className="w-full"
              searchLabel="Search campaigns"
              value={message}
              onValueChange={setMessage}
              options={[
                {
                  value: LATEST,
                  label: forMailbox.length ? "Its running (or latest) campaign" : "Its campaign (it has none: the sample)",
                  divider: true,
                },
                { value: SAMPLE, label: "A neutral sample message", divider: forMailbox.length > 0 },
                ...forMailbox.map((c) => ({ value: String(c.id), label: c.name })),
              ]}
            />
            <span className="text-xs text-muted-foreground">
              The sample shows how the mailbox itself is trusted; a campaign shows how your pitch does.
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => start.mutate()} disabled={!chosen || start.isPending}>
            {start.isPending ? "Starting…" : "Send test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
