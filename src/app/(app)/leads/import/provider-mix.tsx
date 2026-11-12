const LABELS: Record<string, string> = {
  GOOGLE: "Google",
  MICROSOFT: "Microsoft",
  OTHER: "Other",
  UNKNOWN: "No mail server found",
  PENDING: "Not checked yet",
};

/** "60% Google · 30% Microsoft · 10% other" (plan section 12), as a bar and a line. */
export function ProviderMix({ mix }: { mix: Record<string, number> }) {
  const entries = Object.entries(mix).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((n, [, c]) => n + c, 0);
  if (total === 0) return null;
  const tone: Record<string, string> = {
    GOOGLE: "bg-primary",
    MICROSOFT: "bg-success",
    OTHER: "bg-muted-foreground/50",
    UNKNOWN: "bg-destructive",
    PENDING: "bg-muted",
  };
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">Email providers</span>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        {entries.map(([k, n]) => (
          <div key={k} className={tone[k] ?? "bg-muted-foreground/50"} style={{ width: `${(n / total) * 100}%` }} />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {entries.map(([k, n]) => `${Math.round((n / total) * 100)}% ${LABELS[k] ?? k}`).join(" · ")}
        {mix.UNKNOWN ? ". Addresses with no mail server will bounce; consider removing them." : ""}
      </p>
    </div>
  );
}
