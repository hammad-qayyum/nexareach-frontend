import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.25}>
        <path d="M5 19V5l14 14V5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="grid leading-tight">
        <span className="text-sm font-semibold tracking-tight">NexaReach</span>
        <span className="text-xs text-muted-foreground">FastNexa outreach</span>
      </div>
    </div>
  );
}
