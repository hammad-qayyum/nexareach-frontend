import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Campaigns" };

export default function Page() {
  return <ComingSoon href="/campaigns" />;
}
