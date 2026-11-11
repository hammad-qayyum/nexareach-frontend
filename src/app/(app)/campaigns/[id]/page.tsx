import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignDetail } from "./campaign-detail";

export const metadata: Metadata = { title: "Campaign" };

export default function CampaignPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <CampaignDetail />
    </Suspense>
  );
}
