import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NewCampaign } from "./new-campaign";

export const metadata: Metadata = { title: "New campaign" };

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <NewCampaign />
    </Suspense>
  );
}
