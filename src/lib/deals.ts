import { formatDate } from "@/lib/format";

/** Why someone is on Deals' do-not-email list, in words. */
export const DEALS_REASONS: Record<string, string> = {
  lead: "In Deals",
  client: "Client",
  lost: "Lost",
  meta_lead: "Meta ad lead",
  opted_out: "Opted out",
  bounced: "Bounced",
  complained: "Complained",
  forgotten: "Forgotten",
};

/** "Client", or "Lost (until 24 May 2027)". `inSentence`: "client", "lost (until 24 May 2027)". */
export function dealsReason(reason: string, until?: string | null, inSentence = false): string {
  let label = DEALS_REASONS[reason] ?? reason;
  // "Meta ad lead" → "meta ad lead"; dates and names inside keep their capitals.
  if (inSentence) label = label.charAt(0).toLowerCase() + label.slice(1);
  return reason === "lost" && until ? `${label} (until ${formatDate(until)})` : label;
}

/** A lead's stage in Deals. "disqualified" is shown as Not a fit. */
export const DEALS_STAGES: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  disqualified: "Not a fit",
  deleted: "Deleted in Deals",
};

export const dealsStage = (stage?: string | null) => (stage ? (DEALS_STAGES[stage] ?? stage) : "New");

export function usd(value?: number | null): string {
  return value == null ? "" : `$${value.toLocaleString()}`;
}

/** Waiting more than one working day (Monday to Friday) since `since`. */
export function overdue(since: string, now = new Date()): boolean {
  const hour = 3600 * 1000;
  let working = 0;
  for (let t = new Date(since).getTime(); t < now.getTime(); t += hour) {
    const day = new Date(t).getDay();
    if (day !== 0 && day !== 6) working += 1;
    if (working > 24) return true;
  }
  return false;
}
