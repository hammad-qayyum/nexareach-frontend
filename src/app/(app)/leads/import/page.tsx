import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Import" };

export default function Page() {
  return <ComingSoon href="/leads/import" />;
}
