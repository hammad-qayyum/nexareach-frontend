export type Target =
  | "email"
  | "first_name"
  | "last_name"
  | "full_name"
  | "company"
  | "country"
  | "timezone"
  | "custom"
  | "ignore";

export const TARGET_LABELS: Record<Target, string> = {
  email: "Email",
  first_name: "First name",
  last_name: "Last name",
  full_name: "Full name (split into first and last)",
  company: "Company",
  country: "Country",
  timezone: "Timezone (e.g. Asia/Dubai)",
  custom: "Extra field",
  ignore: "Don't import",
};

const GUESSES: [Target, RegExp][] = [
  ["email", /^(e-?mail|email address|e-mail address|work email|business email)$/],
  ["first_name", /^(first|first name|firstname|given name|fname|forename)$/],
  ["last_name", /^(last|last name|lastname|surname|family name|lname)$/],
  ["full_name", /^(name|full name|fullname|contact name|contact)$/],
  ["company", /^(company|company name|organisation|organization|business|business name|account|account name)$/],
  ["country", /^(country|country name|location country)$/],
  ["timezone", /^(timezone|time zone|tz|time-zone)$/],
];

// Names the email template already uses; an extra field can't take them.
const RESERVED = new Set(["email", "first_name", "last_name", "company", "country", "sender_name"]);

export function guessTarget(header: string, taken: Set<Target>): Target {
  const h = header.trim().toLowerCase().replace(/[_\s]+/g, " ");
  for (const [target, pattern] of GUESSES) {
    if (pattern.test(h) && !taken.has(target)) return target;
  }
  if (!taken.has("email") && h.includes("email")) return "email";
  return "custom";
}

/** The {{variable}} name an extra column gets, e.g. "Last Order" → last_order. */
export function fieldKey(header: string): string {
  let key = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 45);
  if (!key) key = "field";
  if (/^[0-9]/.test(key)) key = `f_${key}`;
  if (RESERVED.has(key)) key = `${key}_2`;
  return key;
}

export type MappedRow = {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  country?: string;
  timezone?: string;
  custom: Record<string, string>;
};

export function mapRows(rows: Record<string, string>[], mapping: Record<string, Target>): MappedRow[] {
  const entries = Object.entries(mapping);
  return rows.map((row) => {
    const out: MappedRow = { email: "", custom: {} };
    for (const [header, target] of entries) {
      const value = (row[header] ?? "").trim();
      if (!value || target === "ignore") continue;
      if (target === "custom") out.custom[fieldKey(header)] = value;
      else if (target === "full_name") {
        const [first, ...rest] = value.split(/\s+/);
        out.first_name ??= first;
        if (rest.length) out.last_name ??= rest.join(" ");
      } else out[target] = value;
    }
    return out;
  });
}

/** Excel rows (first row = column names) as the same records Papa Parse gives for a CSV. */
export function sheetToRecords(data: unknown[][]): { headers: string[]; rows: Record<string, string>[] } {
  const [head = [], ...body] = data;
  const headers = head.map((h) => cellText(h).trim());
  const rows = body.map((r) => Object.fromEntries(headers.map((h, i) => [h, cellText(r[i])])));
  return { headers, rows };
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}
