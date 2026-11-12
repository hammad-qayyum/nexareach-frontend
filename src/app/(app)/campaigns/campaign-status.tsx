import { StatusBadge, type Tone } from "@/components/status-dot";
import type { CampaignStatus, RecipientStatus } from "@/lib/api/client";

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
};

export const SKIP_REASONS: Record<string, string> = {
  do_not_contact: "On the do-not-contact list",
  contacted_recently: "Emailed in the last 30 days",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <StatusBadge tone={CAMPAIGN[status].tone}>{CAMPAIGN[status].label}</StatusBadge>;
}

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  return <StatusBadge tone={RECIPIENT[status].tone}>{RECIPIENT[status].label}</StatusBadge>;
}

export const RECIPIENT_STATUSES = Object.keys(RECIPIENT) as RecipientStatus[];
export const recipientLabel = (s: RecipientStatus) => RECIPIENT[s].label;
