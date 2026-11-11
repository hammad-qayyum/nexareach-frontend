import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Tone = "good" | "warn" | "bad" | "info" | "muted";

const DOT: Record<Tone, string> = {
  good: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
  info: "bg-primary",
  muted: "bg-muted-foreground/50",
};

/** An outline badge with a coloured dot: the house style for statuses. */
export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden />
      {children}
    </Badge>
  );
}
