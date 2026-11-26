import type { Lead } from "@/lib/api/client";

export type Provider = NonNullable<Lead["email_provider"]>;

/** Who hosts a lead's email, in the order filters list them. PENDING = imported before providers were checked. */
export const PROVIDER_LABELS: Record<Provider | "PENDING", string> = {
  GOOGLE: "Google",
  MICROSOFT: "Microsoft",
  ZOHO: "Zoho",
  YAHOO: "Yahoo / AOL",
  ICLOUD: "iCloud",
  PROTON: "Proton",
  GODADDY: "GoDaddy",
  TITAN: "Titan",
  YANDEX: "Yandex",
  AMAZON: "Amazon WorkMail",
  MIMECAST: "Mimecast",
  PROOFPOINT: "Proofpoint",
  OWN_SERVER: "Own server",
  OTHER: "Other",
  UNKNOWN: "No mail server",
  PENDING: "Not checked",
};

export const PROVIDER_ORDER = Object.keys(PROVIDER_LABELS) as (Provider | "PENDING")[];

/** A short explanation for the ones people may not know. */
export const PROVIDER_HINTS: Partial<Record<Provider | "PENDING", string>> = {
  OWN_SERVER: "The company runs its own mail server (cPanel and similar).",
  MIMECAST: "A spam filter in front of the company's real mailbox.",
  PROOFPOINT: "A spam filter in front of the company's real mailbox.",
  UNKNOWN: "The domain has no mail server, so emails to it will bounce.",
  PENDING: "Imported before providers were checked.",
};

export function providerLabel(p: string | null | undefined): string {
  return p ? (PROVIDER_LABELS[p as Provider] ?? p) : "—";
}
