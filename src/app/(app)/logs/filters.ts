import type { operations } from "@/lib/api/schema";

export const PAGE_SIZE = 50;

export type LogQuery = NonNullable<operations["list_logs_api_logs_get"]["parameters"]["query"]>;

export type DoneBy = "" | "USER" | "SYSTEM";
export type Range = "" | "today" | "yesterday" | "7d" | "30d" | "custom";

export const RANGES: { value: Range; label: string }[] = [
  { value: "", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom dates" },
];

/** Filter values as they appear in the URL (lists are comma-separated; custom dates are local yyyy-mm-dd). */
export type UrlFilters = {
  q: string;
  actions: string[];
  actors: string[];
  campaigns: string[];
  mailboxes: string[];
  by: DoneBy;
  problems: boolean;
  range: Range;
  entityType: string;
  entityId: string;
  from: string;
  to: string;
  page: number;
};

export const NO_FILTERS: Omit<UrlFilters, "page"> = {
  q: "",
  actions: [],
  actors: [],
  campaigns: [],
  mailboxes: [],
  by: "",
  problems: false,
  range: "",
  entityType: "",
  entityId: "",
  from: "",
  to: "",
};

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

export function readFilters(params: URLSearchParams): UrlFilters {
  const by = params.get("by");
  const range = params.get("range") as Range | null;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  return {
    q: params.get("q") ?? "",
    actions: list(params.get("action")),
    actors: list(params.get("actor")),
    campaigns: list(params.get("campaign")),
    mailboxes: list(params.get("mailbox")),
    by: by === "USER" || by === "SYSTEM" ? by : "",
    problems: params.get("problems") === "1",
    // Old links with only from/to are custom dates.
    range: RANGES.some((r) => r.value === range) ? (range as Range) : from || to ? "custom" : "",
    entityType: params.get("entity_type") ?? "",
    entityId: params.get("entity_id") ?? "",
    from,
    to,
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

export function writeFilters(f: UrlFilters): string {
  const params = new URLSearchParams();
  if (f.q.trim()) params.set("q", f.q.trim());
  if (f.actions.length) params.set("action", f.actions.join(","));
  if (f.actors.length) params.set("actor", f.actors.join(","));
  if (f.campaigns.length) params.set("campaign", f.campaigns.join(","));
  if (f.mailboxes.length) params.set("mailbox", f.mailboxes.join(","));
  if (f.by) params.set("by", f.by);
  if (f.problems) params.set("problems", "1");
  if (f.range) params.set("range", f.range);
  if (f.entityType) params.set("entity_type", f.entityType);
  if (f.entityId) params.set("entity_id", f.entityId);
  if (f.range === "custom" && f.from) params.set("from", f.from);
  if (f.range === "custom" && f.to) params.set("to", f.to);
  if (f.page > 1) params.set("page", String(f.page));
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function activeCount(f: UrlFilters): number {
  return (
    (f.q.trim() ? 1 : 0) +
    f.actions.length +
    f.actors.length +
    f.campaigns.length +
    f.mailboxes.length +
    (f.by ? 1 : 0) +
    (f.problems ? 1 : 0) +
    (f.range && (f.range !== "custom" || f.from || f.to) ? 1 : 0) +
    (f.entityType || f.entityId ? 1 : 0)
  );
}

function localMidnight(day: Date | string, addDays = 0): string {
  const [y, m, d] =
    typeof day === "string" ? day.split("-").map(Number) : [day.getFullYear(), day.getMonth() + 1, day.getDate()];
  return new Date(y, m - 1, d + addDays).toISOString();
}

/** From/to (ISO) for a date choice, in the viewer's own timezone. `to` is exclusive. */
export function rangeBounds(f: Pick<UrlFilters, "range" | "from" | "to">, today = new Date()) {
  switch (f.range) {
    case "today":
      return { from: localMidnight(today), to: undefined };
    case "yesterday":
      return { from: localMidnight(today, -1), to: localMidnight(today) };
    case "7d":
      return { from: localMidnight(today, -6), to: undefined };
    case "30d":
      return { from: localMidnight(today, -29), to: undefined };
    case "custom":
      return { from: f.from ? localMidnight(f.from) : undefined, to: f.to ? localMidnight(f.to, 1) : undefined };
    default:
      return { from: undefined, to: undefined };
  }
}

/** The backend query for these filters. */
export function toApiQuery(f: UrlFilters): LogQuery {
  const dates = rangeBounds(f);
  return {
    q: f.q.trim() || undefined,
    action: f.actions.length ? f.actions : undefined,
    actor_user_id: f.actors.length ? f.actors.map(Number) : undefined,
    actor_type: f.by || undefined,
    campaign_id: f.campaigns.length ? f.campaigns.map(Number) : undefined,
    mailbox_id: f.mailboxes.length ? f.mailboxes.map(Number) : undefined,
    problems: f.problems || undefined,
    entity_type: f.entityType || undefined,
    entity_id: f.entityId || undefined,
    date_from: dates.from,
    date_to: dates.to,
  };
}

export function exportUrl(f: UrlFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(toApiQuery(f))) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, String(v));
  }
  const s = params.toString();
  return `/api/logs/export${s ? `?${s}` : ""}`;
}

/** Prefix options ("All auth actions") followed by every exact action, for the action filter. */
export function actionOptions(actions: string[]): { value: string; label: string; hint?: string }[] {
  const prefixes = [...new Set(actions.map((a) => a.split(".")[0]))].sort();
  return [
    ...prefixes.map((p) => ({ value: `${p}.`, label: `All ${p} actions`, hint: "group" })),
    ...actions.map((a) => ({ value: a, label: a })),
  ];
}
