"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  CornerUpLeftIcon,
  InboxIcon,
  InfoIcon,
  MailIcon,
  PaperclipIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  TriangleAlertIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { SearchableSelect } from "@/components/searchable-select";
import { QueryError } from "@/components/query-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatDate, formatDateTime, formatRelative, initials } from "@/lib/format";
import { REPLY_COUNT_KEY, useReplyCount } from "@/lib/replies";
import { canEdit, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { EmailHtml } from "../campaigns/campaign-form";
import { CampaignStatusBadge, FOLLOW_UP_STOPS } from "../campaigns/campaign-status";
import { fillTemplate, QuickRepliesDialog } from "./quick-replies";

type ReplyState = "open" | "unread" | "done" | "all";
type ReplyItem = Schemas["ReplyOut"];
type ReplyDetail = Schemas["ReplyDetail"];
type ThreadItem = Schemas["ThreadItem"];

const PAGE_SIZE = 30;
const ALL_CAMPAIGNS = "all";
const STATES: { value: ReplyState; label: string }[] = [
  { value: "open", label: "To do" },
  { value: "unread", label: "Unread" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
];
// The server reads inboxes in the background; look again after this long.
const CHECK_WAIT_MS = 8_000;
// The three columns fill the screen below the page header, each scrolling on its own.
const PANE_HEIGHT = "@3xl:h-[calc(100svh-13rem)] @3xl:min-h-[32rem]";

function personName(r: Pick<ReplyItem, "lead_name" | "from_name" | "from_email">) {
  return r.lead_name ?? r.from_name ?? r.from_email;
}

function PersonAvatar({ name, unread = false, className }: { name: string; unread?: boolean; className?: string }) {
  return (
    <Avatar className={cn("shrink-0", className)}>
      <AvatarFallback className={cn("text-xs font-medium", unread ? "bg-primary text-primary-foreground" : "bg-muted")}>
        {initials(name.includes("@") ? name.split("@")[0] : name) || "?"}
      </AvatarFallback>
    </Avatar>
  );
}

export function RepliesView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const openId = Number(params.get("open")) || null;
  const [state, setState] = useState<ReplyState>("open");
  const [q, setQ] = useState("");
  const [campaignId, setCampaignId] = useState<string>(ALL_CAMPAIGNS);
  const [page, setPage] = useState(1);
  const [checking, setChecking] = useState(false);

  const counts = useReplyCount();
  const campaigns = useQuery({ queryKey: ["campaigns"], queryFn: () => unwrap(api.GET("/api/campaigns")) });
  const list = useQuery({
    queryKey: ["replies", "list", state, q, campaignId, page],
    queryFn: () =>
      unwrap(
        api.GET("/api/replies", {
          params: {
            query: {
              state,
              q: q || undefined,
              campaign_id: campaignId === ALL_CAMPAIGNS ? undefined : Number(campaignId),
              limit: PAGE_SIZE,
              offset: (page - 1) * PAGE_SIZE,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const select = (id: number | null) => router.replace(id ? `${pathname}?open=${id}` : pathname, { scroll: false });

  /** After finishing one, open the next reply in the list (or close the pane). */
  function openNext(currentId: number) {
    const items = list.data?.items ?? [];
    const i = items.findIndex((r) => r.id === currentId);
    const next = items[i + 1] ?? items[i - 1];
    select(next && next.id !== currentId ? next.id : null);
  }

  const reloadAll = () => queryClient.invalidateQueries({ queryKey: ["replies"] });

  async function refresh() {
    if (checking) return;
    setChecking(true);
    try {
      if (canEdit(me.role) && counts.data?.checked_mailboxes) {
        // Ask the server to read the inboxes now, then look again once it has had time to.
        await unwrap(api.POST("/api/replies/check"));
        await reloadAll();
        await new Promise((resolve) => setTimeout(resolve, CHECK_WAIT_MS));
      }
      await reloadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't refresh.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Replies"
        description={
          counts.data?.checked_mailboxes === 0 ? (
            <span className="inline-flex flex-wrap items-center gap-1">
              <TriangleAlertIcon className="size-3.5 text-warning" />
              No mailbox has an incoming mail (IMAP) server, so replies can&apos;t arrive on their own.
              <Link href="/mailboxes" className="underline underline-offset-4">
                Set one up
              </Link>
            </span>
          ) : counts.data?.checked_at ? (
            `Inboxes checked ${formatRelative(counts.data.checked_at)}. New replies arrive every 5 minutes.`
          ) : (
            "Inboxes are checked every 5 minutes once campaign emails are out."
          )
        }
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={checking}>
            <RefreshCwIcon data-icon="inline-start" className={cn(checking && "animate-spin")} />
            {checking ? "Checking…" : "Refresh"}
          </Button>
        }
      />
      <div className="@container">
        <div className="grid gap-4 @3xl:grid-cols-[17rem_minmax(0,1fr)] @5xl:grid-cols-[17rem_minmax(0,1fr)_15rem]">
          {/* The list */}
          <Card className={cn("gap-0 overflow-hidden py-0", PANE_HEIGHT, openId ? "hidden @3xl:flex" : "flex")}>
            <div className="grid gap-2 border-b p-3">
              <nav className="grid grid-cols-4 gap-1 @3xl:grid-cols-2" aria-label="Show">
                {STATES.map((s) => {
                  const n = counts.data?.[s.value];
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => {
                        setState(s.value);
                        setPage(1);
                      }}
                      aria-pressed={state === s.value}
                      className={cn(
                        "flex items-center justify-between gap-1 rounded-md px-2 py-1.5 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                        state === s.value ? "bg-muted font-medium" : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                      {!!n && <span className="text-xs tabular-nums">{n}</span>}
                    </button>
                  );
                })}
              </nav>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search"
                  className="h-8 pl-8"
                  aria-label="Search replies"
                />
              </div>
              <SearchableSelect
                size="sm"
                className="w-full"
                label="Filter by campaign"
                searchLabel="Search campaigns"
                value={campaignId}
                onValueChange={(v) => {
                  setCampaignId(v);
                  setPage(1);
                }}
                options={[
                  { value: ALL_CAMPAIGNS, label: "All campaigns", divider: true },
                  ...(campaigns.data ?? [])
                    .filter((c) => c.status !== "DRAFT")
                    .map((c) => ({ value: String(c.id), label: c.name })),
                ]}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {list.error ? (
                <div className="p-3">
                  <QueryError error={list.error} onRetry={() => list.refetch()} />
                </div>
              ) : list.isPending ? (
                <div className="grid gap-2 p-3">
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                </div>
              ) : list.data.items.length === 0 ? (
                <EmptyList state={state} searching={!!q || campaignId !== ALL_CAMPAIGNS} />
              ) : (
                <ul className="divide-y" aria-label="Replies">
                  {list.data.items.map((r) => (
                    <li key={r.id}>
                      <ReplyRow reply={r} selected={r.id === openId} onSelect={() => select(r.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {list.data && list.data.total > PAGE_SIZE && (
              <div className="border-t p-2">
                <Pager page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
              </div>
            )}
          </Card>

          {/* The conversation and its details */}
          {openId ? (
            <Conversation key={openId} id={openId} onClose={() => select(null)} onFinished={() => openNext(openId)} />
          ) : (
            <Card className={cn("hidden place-content-center justify-items-center gap-2 text-center text-sm text-muted-foreground @3xl:grid @5xl:col-span-2", PANE_HEIGHT)}>
              <InboxIcon className="size-8" />
              Choose a reply to read the conversation.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyList({ state, searching }: { state: ReplyState; searching: boolean }) {
  return (
    <div className="grid justify-items-center gap-2 p-8 text-center text-sm text-muted-foreground">
      {state === "open" && !searching ? <CheckIcon className="size-6" /> : <InboxIcon className="size-6" />}
      <p className="font-medium text-foreground">
        {searching
          ? "No replies match."
          : state === "open"
            ? "All caught up."
            : state === "unread"
              ? "No unread replies."
              : state === "done"
                ? "Nothing marked done yet."
                : "No replies yet."}
      </p>
    </div>
  );
}

function ReplyRow({ reply: r, selected, onSelect }: { reply: ReplyItem; selected: boolean; onSelect: () => void }) {
  const unread = !r.read_at && !r.done_at;
  const name = personName(r);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full gap-2.5 px-3 py-2.5 text-left text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50",
        selected && "bg-muted",
      )}
    >
      <PersonAvatar name={name} unread={unread} className="mt-0.5 size-8" />
      <span className="grid min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn("min-w-0 flex-1 truncate", unread ? "font-semibold" : "font-medium")}>{name}</span>
          <span className={cn("shrink-0 text-xs", unread ? "font-medium text-primary" : "text-muted-foreground")}>
            {formatRelative(r.received_at).replace(/^about /, "")}
          </span>
        </span>
        <span className={cn("truncate", unread ? "text-foreground" : "text-muted-foreground")}>{r.snippet || "(no text)"}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{r.campaign?.name ?? r.company ?? r.from_email}</span>
          {r.kind === "OPT_OUT" && <span className="shrink-0 font-medium text-warning">· Asked to stop</span>}
          {r.answered && <CornerUpLeftIcon className="size-3 shrink-0" aria-label="Answered" />}
          {r.done_at && <CheckIcon className="size-3 shrink-0" aria-label="Done" />}
          {r.has_attachments && <PaperclipIcon className="size-3 shrink-0" aria-label="Has attachments" />}
        </span>
      </span>
    </button>
  );
}

function Conversation({ id, onClose, onFinished }: { id: number; onClose: () => void; onFinished: () => void }) {
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const markedRead = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  const reply = useQuery({
    queryKey: ["replies", id],
    queryFn: () => unwrap(api.GET("/api/replies/{reply_id}", { params: { path: { reply_id: id } } })),
  });
  const quickReplies = useQuery({
    queryKey: ["quick-replies"],
    queryFn: () => unwrap(api.GET("/api/quick-replies")),
    enabled: editable,
  });

  function refresh(data: ReplyDetail) {
    queryClient.setQueryData(["replies", id], data);
    queryClient.invalidateQueries({ queryKey: ["replies", "list"] });
    queryClient.invalidateQueries({ queryKey: REPLY_COUNT_KEY });
  }

  const read = useMutation({
    mutationFn: (value: boolean) =>
      unwrap(api.POST("/api/replies/{reply_id}/read", { params: { path: { reply_id: id } }, body: { read: value } })),
    onSuccess: refresh,
  });
  const done = useMutation({
    mutationFn: (value: boolean) =>
      unwrap(api.POST("/api/replies/{reply_id}/done", { params: { path: { reply_id: id } }, body: { done: value } })),
    onSuccess: (data, value) => {
      refresh(data);
      toast.success(value ? "Marked done." : "Back in To do.");
      if (value) onFinished();
    },
    onError: (e) => toast.error(e.message),
  });
  const send = useMutation({
    mutationFn: () =>
      unwrap(api.POST("/api/replies/{reply_id}/answer", { params: { path: { reply_id: id } }, body: { body: answer } })),
    onSuccess: (r) => {
      refresh(r.reply);
      if (r.ok) {
        setAnswer("");
        toast.success(`Answer sent. ${r.detail}`);
      }
    },
  });

  // Opening an unread reply marks it read for everyone (it's a shared inbox).
  const data = reply.data;
  useEffect(() => {
    if (editable && data && !data.read_at && !data.done_at && !markedRead.current) {
      markedRead.current = true;
      read.mutate(true);
    }
  }, [editable, data, read]);

  // Start at the newest message.
  const threadLength = data?.thread.length ?? 0;
  useEffect(() => {
    if (threadLength) endRef.current?.scrollIntoView({ block: "end" });
  }, [threadLength]);

  if (reply.error) return <QueryError error={reply.error} onRetry={() => reply.refetch()} />;
  if (reply.isPending || !data) return <Skeleton className={cn("h-96", PANE_HEIGHT)} />;

  const name = personName(data);
  const firstName = (data.lead_name ?? data.from_name ?? "").split(" ")[0];
  const submit = () => {
    if (answer.trim() && !send.isPending) send.mutate();
  };
  function insertQuickReply(body: string) {
    const text = fillTemplate(body, data!.details.fields);
    setAnswer((current) => (current.trim() ? `${current.trimEnd()}\n\n${text}` : text));
    requestAnimationFrame(() => answerRef.current?.focus());
  }

  return (
    <>
      <Card className={cn("min-w-0 gap-0 overflow-hidden py-0", PANE_HEIGHT, "flex")}>
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Button variant="ghost" size="icon-sm" className="@3xl:hidden" onClick={onClose} aria-label="Back to replies">
            <ArrowLeftIcon />
          </Button>
          <PersonAvatar name={name} />
          <div className="grid min-w-0 flex-1">
            <h2 className="truncate font-semibold">{name}</h2>
            <p className="truncate text-xs text-muted-foreground">{data.subject || "(no subject)"}</p>
          </div>
          {editable && !data.done_at && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => read.mutate(false)}
              disabled={read.isPending || !data.read_at}
              aria-label="Mark unread"
              title="Mark unread"
            >
              <MailIcon />
            </Button>
          )}
          {editable &&
            (data.done_at ? (
              <Button variant="outline" size="sm" onClick={() => done.mutate(false)} disabled={done.isPending}>
                <RotateCcwIcon data-icon="inline-start" /> Reopen
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => done.mutate(true)} disabled={done.isPending}>
                <CheckIcon data-icon="inline-start" /> Done
              </Button>
            ))}
          <Button
            variant="ghost"
            size="icon-sm"
            className="@5xl:hidden"
            onClick={() => setDetailsOpen(true)}
            aria-label="Lead details"
            title="Lead details"
          >
            <InfoIcon />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-4">
            {data.kind === "OPT_OUT" && (
              <Alert>
                <TriangleAlertIcon />
                <AlertDescription>
                  They asked not to be emailed, so they&apos;re on the do-not-contact list. Only answer to confirm,
                  for example that you&apos;ve removed them.
                </AlertDescription>
              </Alert>
            )}
            <ol className="grid grid-cols-[minmax(0,1fr)] gap-3" aria-label="Conversation">
              {data.thread.map((item, i) => (
                <li key={i}>
                  <ThreadBubble
                    item={item}
                    current={item.kind === "reply" && item.id === data.id}
                    // Older emails start folded so the latest stands out; the last two are open.
                    startOpen={i >= data.thread.length - 2}
                  />
                </li>
              ))}
            </ol>
            {data.has_attachments && (
              <p className="text-xs text-muted-foreground">
                <PaperclipIcon className="mr-1 inline size-3.5" />
                This reply had attachments. Open it in the {data.mailbox_email} mailbox to see them.
              </p>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {editable ? (
          <form
            className="grid gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label htmlFor="answer" className="sr-only">
              Answer
            </label>
            <Textarea
              id="answer"
              ref={answerRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={3}
              maxLength={20_000}
              placeholder={`Write your answer to ${firstName || name}…`}
              className="max-h-48 min-h-20 leading-relaxed"
            />
            {send.data && !send.data.ok && <p className="text-sm text-destructive">{send.data.detail}</p>}
            {send.error && <p className="text-sm text-destructive">{send.error.message}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <ZapIcon data-icon="inline-start" /> Quick replies <ChevronDownIcon data-icon="inline-end" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuLabel>Insert a saved answer</DropdownMenuLabel>
                  {(quickReplies.data ?? []).map((qr) => (
                    <DropdownMenuItem key={qr.id} onSelect={() => insertQuickReply(qr.body)} className="grid gap-0.5">
                      <span className="font-medium">{qr.title}</span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {fillTemplate(qr.body, data.details.fields).replace(/\s+/g, " ")}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {quickReplies.data?.length === 0 && (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">No saved answers yet.</p>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setManageOpen(true)}>Manage quick replies…</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="hidden flex-1 text-xs text-muted-foreground sm:block">
                From {data.mailbox_email}. Ctrl+Enter (⌘+Enter) sends.
              </span>
              <Button type="submit" size="sm" className="ml-auto" disabled={send.isPending || !answer.trim()}>
                <SendIcon data-icon="inline-start" /> {send.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="border-t p-3 text-sm text-muted-foreground">Viewers can read replies; a member or admin answers them.</p>
        )}
      </Card>

      {/* Details: a column on wide screens, a side sheet otherwise. */}
      <Card className={cn("hidden gap-0 overflow-y-auto py-0 @5xl:flex", PANE_HEIGHT)}>
        <LeadPanel data={data} />
      </Card>
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Lead details</SheetTitle>
          </SheetHeader>
          <LeadPanel data={data} />
        </SheetContent>
      </Sheet>
      {editable && <QuickRepliesDialog open={manageOpen} onOpenChange={setManageOpen} />}
    </>
  );
}

// Lead fields the panel lists by name (the rest of the custom fields follow, in their own order).
const SHOWN_FIRST = ["city", "country", "property_type", "area", "budget"];
const NOT_LISTED = new Set(["email", "first_name", "last_name", "company", "sender_name", "business_name", "postal_address"]);

function label(key: string) {
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function LeadPanel({ data }: { data: ReplyDetail }) {
  const fields = data.details.fields;
  const keys = [
    ...SHOWN_FIRST.filter((k) => fields[k]),
    ...Object.keys(fields).filter((k) => !SHOWN_FIRST.includes(k) && !NOT_LISTED.has(k) && fields[k]),
  ];
  const d = data.details;
  return (
    <div className="grid content-start gap-5 p-4 text-sm">
      <section className="grid justify-items-center gap-2 text-center">
        <PersonAvatar name={personName(data)} className="size-12" />
        <div className="grid min-w-0 gap-0.5">
          <p className="font-semibold">{personName(data)}</p>
          {data.company && <p className="text-muted-foreground">{data.company}</p>}
          <p className="break-all text-xs text-muted-foreground">{data.from_email}</p>
        </div>
      </section>
      {keys.length > 0 && (
        <section className="grid gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Lead</h3>
          <dl className="grid gap-1.5">
            {keys.map((k) => (
              <div key={k} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">{label(k)}</dt>
                <dd className="break-words">{fields[k]}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {data.campaign && (
        <section className="grid gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Campaign</h3>
          <Link href={`/campaigns/${data.campaign.id}`} className="font-medium underline-offset-4 hover:underline">
            {data.campaign.name}
          </Link>
          {d.campaign_status && (
            <span className="w-fit">
              <CampaignStatusBadge status={d.campaign_status as Schemas["CampaignOut"]["status"]} />
            </span>
          )}
          <dl className="grid gap-1.5">
            {d.first_email_at && (
              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">First email</dt>
                <dd>{formatDate(d.first_email_at)}</dd>
              </div>
            )}
            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">Follow-ups</dt>
              <dd>
                {d.follow_ups_sent} sent
                {d.follow_up_stop ? ` · stopped (${(FOLLOW_UP_STOPS[d.follow_up_stop] ?? d.follow_up_stop).toLowerCase()})` : ""}
              </dd>
            </div>
            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">Mailbox</dt>
              <dd className="truncate" title={data.mailbox_email}>
                {data.mailbox_email}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}

const THREAD_LABEL: Record<string, string> = {
  email: "Campaign email",
  follow_up: "Follow-up",
  answer: "Your answer",
};

function ThreadBubble({ item, current, startOpen }: { item: ThreadItem; current: boolean; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [showQuoted, setShowQuoted] = useState(false);
  const ours = item.kind !== "reply";
  const failed = item.status === "FAILED";
  const text = item.kind === "reply" && showQuoted ? item.full_text : item.text;
  const who = ours ? THREAD_LABEL[item.kind] : item.from_email;
  const when = failed ? "Not sent" : item.at ? formatDateTime(item.at) : "";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 sm:w-[85%]",
          ours ? "ml-auto bg-primary/5" : "bg-card",
        )}
        aria-label={`Show ${who} from ${when}`}
      >
        <span className="shrink-0 font-medium text-foreground">{who}</span>
        <span className="min-w-0 flex-1 truncate">{(item.text ?? "").replace(/\s+/g, " ")}</span>
        <span className="shrink-0">{when}</span>
        <ChevronDownIcon className="size-3.5 shrink-0" />
      </button>
    );
  }
  return (
    <div
      className={cn(
        "grid gap-1.5 rounded-lg border p-3 text-sm sm:w-[85%]",
        ours ? "ml-auto border-primary/20 bg-primary/5" : "bg-card shadow-xs",
        current && "ring-1 ring-primary/40",
        failed && "border-destructive/40",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
        <span className="font-medium text-foreground">
          {who}
          {item.kind === "answer" && item.sent_by ? <span className="font-normal text-muted-foreground"> · {item.sent_by}</span> : null}
        </span>
        <span className={failed ? "text-destructive" : "text-muted-foreground"}>{when}</span>
      </div>
      {failed && item.error && <p className="text-destructive">{item.error}</p>}
      {item.html ? (
        <EmailHtml html={item.html} />
      ) : (
        <pre className="max-h-96 overflow-auto font-sans text-sm leading-relaxed whitespace-pre-wrap">{text || "(no text)"}</pre>
      )}
      {item.kind === "reply" && item.full_text && item.full_text.trim() !== (item.text ?? "").trim() && (
        <Button variant="link" size="sm" className="h-auto w-fit p-0 text-xs" onClick={() => setShowQuoted((v) => !v)}>
          {showQuoted ? "Hide the quoted text" : "Show the quoted text"}
        </Button>
      )}
    </div>
  );
}
