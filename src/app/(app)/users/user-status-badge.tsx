import { Badge } from "@/components/ui/badge";
import type { UserStatus } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const STYLES: Record<UserStatus, { label: string; dot: string }> = {
  ACTIVE: { label: "Active", dot: "bg-success" },
  INVITED: { label: "Invited", dot: "bg-primary" },
  PAUSED: { label: "Paused", dot: "bg-warning" },
  REMOVED: { label: "Removed", dot: "bg-muted-foreground/50" },
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const style = STYLES[status];
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {style.label}
    </Badge>
  );
}
