"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { SearchableSelect } from "@/components/searchable-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { canEdit, isAdmin, useCurrentUser } from "@/lib/session";

type Rule = Schemas["RuleOut"];
type RuleIn = Schemas["RuleIn"];
const RULES_KEY = ["scoring", "rules"] as const;
const SETTINGS_KEY = ["scoring", "settings"] as const;

const SIGNALS: Record<string, string> = {
  question_mark: "The new text has a question mark",
  phone_or_time: "A phone number (7+ digits), a weekday or a time like 3pm",
  company_domain: "Sent from a company address, not free mail",
  colleague_cc: "Copies in someone at the same company",
  machine: "Auto-reply, out of office, bounce or warm-up (set by the existing checks)",
};

/** Settings → Reply score. Plain word rules only, never AI. Admins edit; members can use Try it. */
export function ScoringView() {
  const me = useCurrentUser();
  if (!canEdit(me.role)) return <Forbidden />;
  const admin = isAdmin(me.role);
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/settings">
            <ArrowLeftIcon /> Settings
          </Link>
        </Button>
        <PageHeader
          title="Reply score"
          description="Every real reply gets 0 to 100 from these word rules. No AI reads or scores replies."
        />
      </div>
      {admin && <ScoreSettings />}
      <TryIt />
      {admin && <Rules />}
    </div>
  );
}

function ScoreSettings() {
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: () => unwrap(api.GET("/api/scoring/settings")) });
  if (settings.error) return <QueryError error={settings.error} onRetry={() => settings.refetch()} />;
  if (settings.isPending) return <Skeleton className="h-64 max-w-2xl" />;
  return <ScoreSettingsForm key={JSON.stringify(settings.data)} initial={settings.data} />;
}

function ScoreSettingsForm({ initial }: { initial: Schemas["ScoreSettingsIO"] }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [auto, setAuto] = useState(String(initial.auto_threshold));
  const [review, setReview] = useState(String(initial.review_threshold));
  const [domains, setDomains] = useState(initial.free_mail_domains.join("\n"));
  const autoN = Number(auto);
  const reviewN = Number(review);
  const error =
    !Number.isInteger(autoN) || autoN < 1 || autoN > 100
      ? "The auto line must be 1 to 100."
      : !Number.isInteger(reviewN) || reviewN < 0 || reviewN > 99
        ? "The review line must be 0 to 99."
        : autoN <= reviewN
          ? "The auto line must be above the review line."
          : null;
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PUT("/api/scoring/settings", {
          body: {
            enabled,
            auto_threshold: autoN,
            review_threshold: reviewN,
            free_mail_domains: domains.split(/[\s,]+/).filter(Boolean),
          },
        }),
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_KEY, data);
      queryClient.invalidateQueries({ queryKey: ["replies"] });
      toast.success(
        data.enabled && !initial.enabled ? "Scoring is on. Earlier replies got a score to look at." : "Saved.",
      );
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Scoring and cut-offs</CardTitle>
        <CardDescription>
          At or above the auto line a reply goes straight to Deals (if handover is on). Between the two lines it waits
          on the Needs review list. Below, it stays in NexaReach.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Label className="flex items-start gap-3 font-normal">
            <Checkbox className="mt-0.5" checked={enabled} onCheckedChange={(on) => setEnabled(on === true)} />
            <span className="grid gap-1">
              <span className="font-medium">Score replies</span>
              <span className="text-sm text-muted-foreground">
                Replies found from now on are scored and sorted. Earlier replies get a score to look at, but never
                join the review list or go to Deals by themselves.
              </span>
            </span>
          </Label>
          <div className="flex flex-wrap gap-4">
            <Field className="w-36">
              <FieldLabel htmlFor="score-auto">Straight to Deals at</FieldLabel>
              <Input id="score-auto" inputMode="numeric" value={auto} onChange={(e) => setAuto(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field className="w-36">
              <FieldLabel htmlFor="score-review">Needs review from</FieldLabel>
              <Input
                id="score-review"
                inputMode="numeric"
                value={review}
                onChange={(e) => setReview(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Field>
            <FieldLabel htmlFor="free-mail">Free-mail domains</FieldLabel>
            <Textarea id="free-mail" rows={4} value={domains} onChange={(e) => setDomains(e.target.value)} className="font-mono text-xs" />
            <FieldDescription>
              A reply from these isn&apos;t from a company address (for &ldquo;Company email&rdquo; and &ldquo;Brings a
              colleague&rdquo;). One per line.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={() => save.mutate()} disabled={!!error || save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function TryIt() {
  const [text, setText] = useState("");
  const [sender, setSender] = useState("");
  const [cc, setCc] = useState("");
  const run = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/scoring/try", {
          body: { text, sender, cc: cc.split(/[\s,;]+/).filter(Boolean) },
        }),
      ),
    onError: (e) => toast.error(e.message),
  });
  const r = run.data;
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Try it</CardTitle>
        <CardDescription>Paste a reply to see its score with the current rules. Nothing is saved.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run.mutate();
          }}
        >
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Interested. Can we do a call on Thursday?\n\nOn Tue, Sara wrote:\n> …"}
            aria-label="Reply text"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="From: jane@acme.com" aria-label="Sender" />
            <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Cc (optional)" aria-label="Cc" />
          </div>
          <Button type="submit" className="w-fit" disabled={!text.trim() || run.isPending}>
            Score it
          </Button>
        </form>
        {r && (
          <div className="mt-4 grid gap-2 rounded-lg border p-3 text-sm">
            <p>
              <span className="text-2xl font-semibold tabular-nums">{r.score}</span>{" "}
              <span className="text-muted-foreground">
                {r.band === "auto" ? "Straight to Deals" : r.band === "review" ? "Needs review" : r.band === "zero" ? `Hard stop (${r.hard_stop})` : "Stays in NexaReach"}
              </span>
            </p>
            <p className="text-muted-foreground">Matched: {r.matched.length ? r.matched.join(", ") : "nothing"}</p>
            <details>
              <summary className="cursor-pointer text-muted-foreground">What the rules read</summary>
              <pre className="mt-2 text-xs whitespace-pre-wrap">{r.new_text || "(nothing new)"}</pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Rules() {
  const queryClient = useQueryClient();
  const rules = useQuery({ queryKey: RULES_KEY, queryFn: () => unwrap(api.GET("/api/scoring/rules")) });
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => unwrap(api.DELETE("/api/scoring/rules/{rule_id}", { params: { path: { rule_id: id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RULES_KEY });
      toast.success("Rule removed.");
    },
    onError: (e) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (r: Rule) =>
      unwrap(
        api.PUT("/api/scoring/rules/{rule_id}", {
          params: { path: { rule_id: r.id } },
          body: {
            ...r,
            kind: r.kind as RuleIn["kind"],
            hard_stop: r.hard_stop === "no" || r.hard_stop === "machine" ? r.hard_stop : null,
            enabled: !r.enabled,
          },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="grid gap-1.5">
          <CardTitle>Rules</CardTitle>
          <CardDescription>
            Each rule counts once, however often its words appear. A hard stop makes the score 0. Words in any language
            work; they match whole words only.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <PlusIcon data-icon="inline-start" /> Add rule
        </Button>
      </CardHeader>
      <CardContent>
        {rules.error ? (
          <QueryError error={rules.error} onRetry={() => rules.refetch()} />
        ) : rules.isPending ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Rule</TableHead>
                  <TableHead>Words or signal</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.data.map((r) => (
                  <TableRow key={r.id} className={r.enabled ? undefined : "opacity-50"}>
                    <TableCell>
                      <Checkbox
                        checked={r.enabled}
                        onCheckedChange={() => toggle.mutate(r)}
                        aria-label={r.enabled ? `Switch off ${r.name}` : `Switch on ${r.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="max-w-md text-muted-foreground">
                      {r.kind === "words"
                        ? r.words.join(", ")
                        : r.kind === "regex"
                          ? <code className="text-xs">{r.pattern}</code>
                          : SIGNALS[r.signal ?? ""] ?? r.signal}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.hard_stop ? <span className="font-medium">0 · hard stop</span> : r.points > 0 ? `+${r.points}` : r.points}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`}>
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => confirm(`Remove the rule "${r.name}"?`) && remove.mutate(r.id)}
                        aria-label={`Remove ${r.name}`}
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {editing && <RuleDialog rule={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function RuleDialog({ rule, onClose }: { rule: Rule | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(rule?.name ?? "");
  const [kind, setKind] = useState<RuleIn["kind"]>((rule?.kind as RuleIn["kind"]) ?? "words");
  const [words, setWords] = useState((rule?.words ?? []).join(", "));
  const [pattern, setPattern] = useState(rule?.pattern ?? "");
  const [signal, setSignal] = useState(rule?.signal ?? "question_mark");
  const [points, setPoints] = useState(String(rule?.points ?? 10));
  const [hardStop, setHardStop] = useState(rule?.hard_stop ?? "");
  const body: RuleIn = {
    name,
    kind,
    words: words.split(",").map((w) => w.trim()).filter(Boolean),
    pattern: kind === "regex" ? pattern : null,
    signal: kind === "signal" ? signal : null,
    points: Number(points) || 0,
    hard_stop: hardStop === "no" || hardStop === "machine" ? hardStop : null,
    enabled: rule?.enabled ?? true,
  };
  const save = useMutation({
    mutationFn: () =>
      rule
        ? unwrap(api.PUT("/api/scoring/rules/{rule_id}", { params: { path: { rule_id: rule.id } }, body }))
        : unwrap(api.POST("/api/scoring/rules", { body })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RULES_KEY });
      toast.success(rule ? "Rule saved." : "Rule added.");
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "Add rule"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field>
            <FieldLabel htmlFor="rule-name">Name</FieldLabel>
            <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="rule-kind">Matches</FieldLabel>
            <SearchableSelect
              id="rule-kind"
              className="w-full"
              value={kind}
              onValueChange={(v) => setKind(v as RuleIn["kind"])}
              options={[
                { value: "words", label: "Words or phrases" },
                { value: "regex", label: "A pattern (regular expression)" },
                { value: "signal", label: "A built-in signal" },
              ]}
            />
          </Field>
          {kind === "words" && (
            <Field>
              <FieldLabel htmlFor="rule-words">Words or phrases</FieldLabel>
              <Textarea id="rule-words" rows={3} value={words} onChange={(e) => setWords(e.target.value)} />
              <FieldDescription>Separated by commas. Upper or lower case doesn&apos;t matter.</FieldDescription>
            </Field>
          )}
          {kind === "regex" && (
            <Field>
              <FieldLabel htmlFor="rule-pattern">Pattern</FieldLabel>
              <Input id="rule-pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} className="font-mono" />
              <FieldDescription>Patterns that could take too long on some replies are refused.</FieldDescription>
            </Field>
          )}
          {kind === "signal" && (
            <Field>
              <FieldLabel htmlFor="rule-signal">Signal</FieldLabel>
              <SearchableSelect
                id="rule-signal"
                className="w-full"
                value={signal}
                onValueChange={setSignal}
                options={Object.entries(SIGNALS).map(([value, label]) => ({ value, label }))}
              />
            </Field>
          )}
          <div className="flex flex-wrap gap-4">
            <Field className="w-28">
              <FieldLabel htmlFor="rule-points">Points</FieldLabel>
              <Input id="rule-points" value={points} onChange={(e) => setPoints(e.target.value.replace(/[^\d-]/g, ""))} />
            </Field>
            <Field className="w-48">
              <FieldLabel htmlFor="rule-stop">Hard stop</FieldLabel>
              <SearchableSelect
                id="rule-stop"
                className="w-full"
                value={hardStop || "none"}
                onValueChange={(v) => setHardStop(v === "none" ? "" : v)}
                options={[
                  { value: "none", label: "No" },
                  { value: "no", label: "Yes: they said no" },
                  { value: "machine", label: "Yes: a machine reply" },
                ]}
              />
            </Field>
          </div>
          {save.error && (
            <Alert variant="destructive">
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
