import { StatusBadge, type Tone } from "@/components/status-dot";
import type { CampaignStatus, RecipientStatus } from "@/lib/api/client";
import { dealsReason } from "@/lib/deals";

const CAMPAIGN: Record<CampaignStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "muted" },
  RUNNING: { label: "Sending", tone: "info" },
  PAUSED: { label: "Paused", tone: "warn" },
  COMPLETED: { label: "Finished", tone: "good" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};

const RECIPIENT: Record<RecipientStatus, { label: string; tone: Tone }> = {
  WAITING: { label: "Waiting", tone: "muted" },
  SENDING: { label: "Sending", tone: "info" },
  SENT: { label: "Sent", tone: "good" },
  FAILED: { label: "Failed", tone: "bad" },
  SKIPPED: { label: "Skipped", tone: "warn" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
  BLOCKED_BY_DEALS: { label: "Blocked by Deals", tone: "bad" },
  HANDED_TO_DEALS: { label: "Handed to Deals", tone: "info" },
};

export const SKIP_REASONS: Record<string, string> = {
  do_not_contact: "On the do-not-contact list",
  contacted_recently: "Emailed in the last 30 days",
  forgotten: "Asked to be forgotten",
};

/** Why someone's follow-ups stopped early. */
export const FOLLOW_UP_STOPS: Record<string, string> = {
  replied: "Replied",
  opted_out: "Asked not to be emailed (added to do-not-contact)",
  bounced: "Bounced: the email couldn't be delivered",
  do_not_contact: "Put on the do-not-contact list",
  failed: "A follow-up couldn't be sent",
  cancelled: "Campaign cancelled",
  forgotten: "Asked to be forgotten",
  blocked_by_deals: "On the Deals do-not-email list",
  complained: "Marked our email as spam (added to do-not-contact)",
  handed_to_deals: "Handed to Deals: their sales team takes it from here",
};

/** Why this person wasn't emailed. For "Blocked by Deals" the reason is Deals' own (client, lost…). */
export function skipReason(status: RecipientStatus, reason: string): string {
  if (status === "BLOCKED_BY_DEALS") return `On the Deals do-not-email list: ${dealsReason(reason, null, true)}`;
  return SKIP_REASONS[reason] ?? reason;
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <StatusBadge tone={CAMPAIGN[status].tone}>{CAMPAIGN[status].label}</StatusBadge>;
}

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  return <StatusBadge tone={RECIPIENT[status].tone}>{RECIPIENT[status].label}</StatusBadge>;
}

export const RECIPIENT_STATUSES = Object.keys(RECIPIENT) as RecipientStatus[];
export const recipientLabel = (s: RecipientStatus) => RECIPIENT[s].label;
