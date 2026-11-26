import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { RepliesView } from "./replies-view";

export const metadata: Metadata = { title: "Replies" };

export default function RepliesPage() {
  return (
    <Suspense fallback={<PageHeader title="Replies" />}>
      <RepliesView />
    </Suspense>
  );
}
