import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupDetail } from "./group-detail";

export const metadata: Metadata = { title: "Group" };

export default function GroupPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <GroupDetail />
    </Suspense>
  );
}
