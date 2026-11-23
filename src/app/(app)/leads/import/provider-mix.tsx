import { PROVIDER_ORDER, providerLabel } from "@/lib/providers";

/** Named in the line of text; smaller ones are added up as "other providers". */
const NAMED = 5;

const TONE: Record<string, string> = {
  GOOGLE: "bg-primary",
  MICROSOFT: "bg-success",
  ZOHO: "bg-chart-3",
  OWN_SERVER: "bg-chart-4",
  YAHOO: "bg-chart-5",
  UNKNOWN: "bg-destructive",
  PENDING: "bg-muted",
};

/** "60% Google · 30% Microsoft · 10% other" (plan section 12), as a bar and a line. */
export function ProviderMix({ mix }: { mix: Record<string, number> }) {
  const entries = Object.entries(mix)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || PROVIDER_ORDER.indexOf(a[0] as never) - PROVIDER_ORDER.indexOf(b[0] as never));
  const total = entries.reduce((n, [, c]) => n + c, 0);
  if (total === 0) return null;
  const pct = (n: number) => `${Math.max(1, Math.round((n / total) * 100))}%`;
  const named = entries.length > NAMED + 1 ? entries.slice(0, NAMED) : entries;
  const rest = entries.slice(named.length).reduce((n, [, c]) => n + c, 0);
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">Email providers</span>
      <div className="flex h-2 gap-px overflow-hidden rounded-full bg-muted" aria-hidden>
        {entries.map(([k, n]) => (
          <div
            key={k}
            title={`${providerLabel(k)}: ${n.toLocaleString()}`}
            className={TONE[k] ?? "bg-muted-foreground/50"}
            style={{ width: `${(n / total) * 100}%` }}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {[
          ...named.map(([k, n]) => `${pct(n)} ${providerLabel(k)}`),
          ...(rest ? [`${pct(rest)} ${entries.length - named.length} other providers`] : []),
        ].join(" · ")}
        {mix.UNKNOWN ? ". Addresses with no mail server will bounce; consider removing them." : ""}
      </p>
    </div>
  );
}
