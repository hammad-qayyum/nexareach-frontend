import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { navItem } from "@/lib/nav";

/** Placeholder for a Phase 1 page whose milestone hasn't been built yet. */
export function ComingSoon({ href }: { href: string }) {
  const item = navItem(href);
  return (
    <div className="grid gap-6">
      <PageHeader title={item.title} description={item.description} />
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <item.icon />
          </EmptyMedia>
          <EmptyTitle>Not built yet</EmptyTitle>
          <EmptyDescription>
            This page arrives with milestone {item.milestone} of Phase 1.
          </EmptyDescription>
        </EmptyHeader>
        {item.milestone && <Badge variant="outline">Milestone {item.milestone}</Badge>}
      </Empty>
    </div>
  );
}
