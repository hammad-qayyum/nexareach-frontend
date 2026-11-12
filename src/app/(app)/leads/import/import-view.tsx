"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2Icon, FileUpIcon, MegaphoneIcon, UsersRoundIcon } from "lucide-react";
import Link from "next/link";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Forbidden } from "@/components/forbidden";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { canEdit, useCurrentUser } from "@/lib/session";
import { fieldKey, guessTarget, mapRows, sheetToRecords, TARGET_LABELS, type Target } from "./columns";
import { ProviderMix } from "./provider-mix";

const MAX_ROWS = 20_000;

type Parsed = { fileName: string; headers: string[]; rows: Record<string, string>[] };

export function ImportView() {
  const me = useCurrentUser();
  if (!canEdit(me.role)) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Import leads" />
        <Forbidden title="View only" description="Viewers can see everything but can't make changes." />
      </div>
    );
  }
  return <ImportWizard />;
}

function ImportWizard() {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mode, setMode] = useState<"file" | "paste" | "sheet">("file");
  const [pasted, setPasted] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [mapping, setMapping] = useState<Record<string, Target>>({});
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [result, setResult] = useState<Schemas["ImportOut"] | null>(null);

  function load(fileName: string, rawHeaders: string[], rawRows: Record<string, string>[]) {
    const headers = rawHeaders.filter((h) => h.trim() !== "");
    const rows = rawRows.filter((r) => Object.values(r).some((v) => (v ?? "").trim() !== ""));
    if (headers.length === 0 || rows.length === 0) {
      setParseError("That file has no rows. The first line must be the column names.");
      return;
    }
    if (rows.length > MAX_ROWS) {
      setParseError(`That file has ${rows.length.toLocaleString()} rows. Split it into files of up to 20,000.`);
      return;
    }
    const taken = new Set<Target>();
    const guessed: Record<string, Target> = {};
    for (const h of headers) {
      const t = guessTarget(h, taken);
      if (t !== "custom") taken.add(t);
      guessed[h] = t;
    }
    setParseError(null);
    setParsed({ fileName, headers, rows });
    setMapping(guessed);
    setName(fileName.replace(/\.(csv|txt|xlsx)$/i, ""));
    setResult(null);
  }

  function loadCsvText(fileName: string, text: string) {
    const results = Papa.parse<Record<string, string>>(text.trim(), parseConfig);
    load(fileName, results.meta.fields ?? [], results.data);
  }

  const parseConfig = { header: true, skipEmptyLines: "greedy" as const, transformHeader: (h: string) => h.trim() };

  async function onFile(file: File) {
    if (/\.xlsx$/i.test(file.name)) {
      try {
        const { headers, rows } = sheetToRecords(await readSheet(file));
        load(file.name, headers, rows);
      } catch {
        setParseError("Couldn't read that Excel file. Save it as .xlsx (or CSV) and try again.");
      }
      return;
    }
    if (/\.xls$/i.test(file.name)) {
      setParseError("Old .xls files aren't supported. In Excel, use File → Save As → .xlsx or CSV.");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      ...parseConfig,
      complete: (results) => load(file.name, results.meta.fields ?? [], results.data),
      error: (e) => setParseError(`Couldn't read that file: ${e.message}`),
    });
  }

  const sheet = useMutation({
    mutationFn: () => unwrap(api.POST("/api/groups/google-sheet", { body: { url: sheetUrl } })),
    onSuccess: (data) => loadCsvText(`Google Sheet ${format(new Date(), "d MMM HH:mm")}`, data.csv),
    onError: (e) => setParseError(e.message),
  });

  function reset() {
    setParsed(null);
    setMapping({});
    setName("");
    setSource("");
    setPasted("");
    setSheetUrl("");
    setResult(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  const emailColumns = Object.values(mapping).filter((t) => t === "email").length;
  const mappingError =
    emailColumns === 0 ? "Choose which column holds the email address." : emailColumns > 1 ? "Only one column can be the email." : null;

  const submit = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/groups/import", {
          body: { name, source: source || null, rows: mapRows(parsed!.rows, mapping) },
        }),
      ),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  if (result) return <ImportResult result={result} onAnother={reset} />;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Import leads"
        description="Upload a CSV or Excel file, or link a Google Sheet. Match its columns, and the leads become a group you can send a campaign to."
      />

      <Card>
        <CardHeader>
          <CardTitle>1. Choose your leads</CardTitle>
          <CardDescription>The first row must hold the column names.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            id="csv-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
          {parsed ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <FileUpIcon className="size-4 text-muted-foreground" />
              <span className="font-medium">{parsed.fileName}</span>
              <span className="text-muted-foreground">
                {parsed.rows.length.toLocaleString()} rows · {parsed.headers.length} columns
              </span>
              <Button variant="outline" size="sm" onClick={reset}>
                Choose another file
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <TabsList>
                  <TabsTrigger value="file">CSV or Excel file</TabsTrigger>
                  <TabsTrigger value="sheet">Google Sheets link</TabsTrigger>
                  <TabsTrigger value="paste">Paste CSV text</TabsTrigger>
                </TabsList>
              </Tabs>
              {mode === "file" && (
                <Button className="w-fit" onClick={() => fileInput.current?.click()}>
                  <FileUpIcon data-icon="inline-start" /> Choose file (.csv or .xlsx)
                </Button>
              )}
              {mode === "sheet" && (
                <form
                  className="grid gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sheet.mutate();
                  }}
                >
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/…"
                      aria-label="Google Sheets link"
                      className="min-w-72 flex-1"
                      required
                    />
                    <Button type="submit" variant="outline" disabled={sheet.isPending || !sheetUrl.trim()}>
                      {sheet.isPending ? "Fetching…" : "Fetch sheet"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    In Google Sheets, click Share → General access → &ldquo;Anyone with the link&rdquo; (Viewer), then copy
                    the link. The tab that&apos;s open in the link is the one imported.
                  </p>
                </form>
              )}
              {mode === "paste" && (
                <div className="grid gap-2">
                  <Textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                    placeholder={"email,first_name,company\nsara@acme.com,Sara,Acme"}
                    aria-label="CSV text"
                  />
                  <Button
                    variant="outline"
                    className="w-fit"
                    disabled={!pasted.trim()}
                    onClick={() => loadCsvText(`Pasted leads ${format(new Date(), "d MMM HH:mm")}`, pasted)}
                  >
                    Use this text
                  </Button>
                </div>
              )}
            </div>
          )}
          {parseError && (
            <Alert variant="destructive">
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle>2. Match the columns</CardTitle>
            <CardDescription>
              Extra fields can be used in the email as variables, such as {"{{industry}}"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-4">Column in your file</TableHead>
                    <TableHead>Example values</TableHead>
                    <TableHead className="w-72">Import as</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.headers.map((h) => {
                    const examples = parsed.rows
                      .map((r) => (r[h] ?? "").trim())
                      .filter(Boolean)
                      .slice(0, 2);
                    return (
                      <TableRow key={h}>
                        <TableCell className="pl-4 font-medium">{h}</TableCell>
                        <TableCell className="max-w-64 truncate text-muted-foreground">
                          {examples.join(" · ") || "(empty)"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={mapping[h]}
                              onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v as Target }))}
                            >
                              <SelectTrigger className="w-48" aria-label={`Import ${h} as`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(TARGET_LABELS) as Target[]).map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {TARGET_LABELS[t]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {mapping[h] === "custom" && (
                              <code className="truncate font-mono text-xs text-muted-foreground">{`{{${fieldKey(h)}}}`}</code>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {mappingError && <p className="text-sm text-destructive">{mappingError}</p>}
          </CardContent>
        </Card>
      )}

      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle>3. Name the group</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="max-w-xl">
              <Field>
                <FieldLabel htmlFor="group-name">Group name</FieldLabel>
                <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="group-source">Where the leads came from</FieldLabel>
                <Input
                  id="group-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  maxLength={200}
                  placeholder="LinkedIn research, October"
                />
                <FieldDescription>Kept for data-protection records.</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-wrap justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Invalid addresses are left out. Addresses already in the system wait for you to review as duplicates.
            </span>
            <Button onClick={() => submit.mutate()} disabled={!!mappingError || !name.trim() || submit.isPending}>
              {submit.isPending ? "Importing…" : `Import ${parsed.rows.length.toLocaleString()} rows`}
            </Button>
          </CardFooter>
          {submit.error && (
            <CardContent>
              <Alert variant="destructive">
                <AlertDescription>{submit.error.message}</AlertDescription>
              </Alert>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function ImportResult({ result, onAnother }: { result: Schemas["ImportOut"]; onAnother: () => void }) {
  const stats = [
    { label: "New leads", value: result.added },
    { label: "Duplicates to review", value: result.pending_duplicates },
    { label: "Invalid, left out", value: result.invalid_count },
  ];
  return (
    <div className="grid gap-6">
      <PageHeader title="Import leads" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2Icon className="size-5 text-success" />
            {result.group.lead_count.toLocaleString()} leads are in &ldquo;{result.group.name}&rdquo;
          </CardTitle>
          <CardDescription>The group is ready to use in a campaign.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="grid gap-1 rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="text-xl font-semibold tabular-nums">{s.value.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          <ProviderMix mix={result.provider_mix} />
          {result.pending_duplicates > 0 && (
            <Alert>
              <AlertDescription>
                {result.pending_duplicates.toLocaleString()} row{result.pending_duplicates === 1 ? " has an email" : "s have emails"} that
                {result.pending_duplicates === 1 ? " is" : " are"} already in the system or repeated in this file. They aren&apos;t in the group
                and won&apos;t be emailed until you{" "}
                <Link href="/leads/duplicates" className="font-medium underline underline-offset-4">
                  review the duplicates
                </Link>
                .
              </AlertDescription>
            </Alert>
          )}
          {result.invalid.length > 0 && (
            <div className="grid gap-2">
              <span className="text-sm font-medium">Rows left out</span>
              <ul className="max-h-40 overflow-auto rounded-md border p-2 font-mono text-xs text-muted-foreground">
                {result.invalid.map((r) => (
                  <li key={r.row}>
                    Row {r.row}: {r.email || "(no email)"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button asChild>
            <Link href={`/campaigns/new?group=${result.group.id}`}>
              <MegaphoneIcon data-icon="inline-start" /> Write a campaign for this group
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/leads/groups/${result.group.id}`}>
              <UsersRoundIcon data-icon="inline-start" /> View the leads
            </Link>
          </Button>
          <Button variant="ghost" onClick={onAnother}>
            Import another file
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
