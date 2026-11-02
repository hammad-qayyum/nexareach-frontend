import type { operations } from "@/lib/api/schema";

export const PAGE_SIZE = 50;

export type LogQuery = NonNullable<operations["list_logs_api_logs_get"]["parameters"]["query"]>;

/** Filter values as they appear in the URL (dates are local yyyy-mm-dd). */
export type UrlFilters = {
  action: string;
  actor: string;
  entityType: string;
  entityId: string;
  from: string;
  to: string;
  page: number;
};

export function readFilters(params: URLSearchParams): UrlFilters {
  return {
    action: params.get("action") ?? "",
    actor: params.get("actor") ?? "",
    entityType: params.get("entity_type") ?? "",
    entityId: params.get("entity_id") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

export function writeFilters(f: UrlFilters): string {
  const params = new URLSearchParams();
  if (f.action) params.set("action", f.action);
  if (f.actor) params.set("actor", f.actor);
  if (f.entityType) params.set("entity_type", f.entityType);
  if (f.entityId) params.set("entity_id", f.entityId);
  if (f.from) params.set("from", f.from);
  if (f.to) params.set("to", f.to);
  if (f.page > 1) params.set("page", String(f.page));
  const s = params.toString();
  return s ? `?${s}` : "";
}

function localMidnight(day: string, addDays = 0): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d + addDays).toISOString();
}

/** The backend query for these filters. `to` is inclusive, so it becomes midnight of the next day. */
export function toApiQuery(f: UrlFilters): LogQuery {
  return {
    action: f.action || undefined,
    actor_user_id: f.actor ? Number(f.actor) : undefined,
    entity_type: f.entityType || undefined,
    entity_id: f.entityId || undefined,
    date_from: f.from ? localMidnight(f.from) : undefined,
    date_to: f.to ? localMidnight(f.to, 1) : undefined,
  };
}

export function exportUrl(f: UrlFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(toApiQuery(f))) {
    if (value !== undefined) params.set(key, String(value));
  }
  const s = params.toString();
  return `/api/logs/export${s ? `?${s}` : ""}`;
}

/** Prefix options ("auth.") followed by every exact action, for the action filter. */
export function actionOptions(actions: string[]): { value: string; label: string }[] {
  const prefixes = [...new Set(actions.map((a) => a.split(".")[0]))].sort();
  return [
    ...prefixes.map((p) => ({ value: `${p}.`, label: `All ${p} actions` })),
    ...actions.map((a) => ({ value: a, label: a })),
  ];
}
