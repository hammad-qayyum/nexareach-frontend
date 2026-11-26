"use client";

import { useQuery } from "@tanstack/react-query";
import type { Tone } from "@/components/status-dot";
import { api, type Schemas, unwrap } from "@/lib/api/client";

export const DELIVERABILITY_KEY = ["deliverability"] as const;
export const ALERT_COUNT_KEY = ["deliverability", "alerts", "count"] as const;

/** Open alerts and paused mailboxes, for the sidebar and the banner on every page. */
export function useAlertCount() {
  return useQuery({
    queryKey: ALERT_COUNT_KEY,
    queryFn: () => unwrap(api.GET("/api/deliverability/alerts/count")),
    refetchInterval: 60_000,
  });
}

/** Why a mailbox's campaign emails were paused (mailbox.campaigns_paused_reason, an alert kind). */
export const PAUSE_REASON: Record<string, string> = {
  warmup_low: "its warm-up inbox rate stayed under 50% for 3 days",
  low_inbox_rate: "its warm-up inbox rate stayed under 50% for 3 days",
  hard_bounces: "too many of its emails bounced (addresses that don't exist)",
  blacklisted: "its mail server is on a blacklist",
  dns_broken: "its domain's email records (SPF, DKIM, DMARC or MX) are broken",
};

export function pauseReason(reason: string | null | undefined) {
  return (reason && PAUSE_REASON[reason]) || "a deliverability alert";
}

export type DeliveryStatus = Schemas["DeliveryEventOut"]["status"];

export const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; tone: Tone }> = {
  SENT: { label: "Sent", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "good" },
  DEFERRED: { label: "Delayed", tone: "warn" },
  SOFT_BOUNCE: { label: "Soft bounce", tone: "warn" },
  HARD_BOUNCE: { label: "Hard bounce", tone: "bad" },
  REJECTED: { label: "Refused", tone: "bad" },
};

export const DELIVERY_SOURCE: Record<Schemas["DeliveryEventOut"]["source"], string> = {
  SMTP: "Send",
  CPANEL: "cPanel log",
  BOUNCE: "Bounce email",
};

export type HealthStatus = Schemas["HealthCheckOut"]["status"];

export const HEALTH: Record<HealthStatus, { label: string; tone: Tone }> = {
  OK: { label: "OK", tone: "good" },
  WARN: { label: "Warning", tone: "warn" },
  FAIL: { label: "Problem", tone: "bad" },
  UNKNOWN: { label: "Couldn't check", tone: "muted" },
};

export const FOLDER: Record<NonNullable<Schemas["PlacementResultOut"]["folder"]>, { label: string; tone: Tone }> = {
  INBOX: { label: "Inbox", tone: "good" },
  PROMOTIONS: { label: "Promotions", tone: "warn" },
  SPAM: { label: "Spam", tone: "bad" },
  MISSING: { label: "Missing", tone: "bad" },
};

export function percent(part: number, total: number, digits = 0) {
  if (!total) return "—";
  return `${((part / total) * 100).toFixed(digits)}%`;
}
