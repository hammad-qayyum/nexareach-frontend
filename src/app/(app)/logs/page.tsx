import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { LogsView } from "./logs-view";

export const metadata: Metadata = { title: "Activity log" };

export default function LogsPage() {
  return (
    <Suspense fallback={<PageHeader title="Activity log" />}>
      <LogsView />
    </Suspense>
  );
}
