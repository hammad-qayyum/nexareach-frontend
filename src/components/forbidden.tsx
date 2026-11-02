import { LockIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function Forbidden() {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon />
        </EmptyMedia>
        <EmptyTitle>Admins only</EmptyTitle>
        <EmptyDescription>Your role doesn&apos;t have access to this page.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
