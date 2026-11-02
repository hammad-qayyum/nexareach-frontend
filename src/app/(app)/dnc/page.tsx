import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Do not contact" };

export default function Page() {
  return <ComingSoon href="/dnc" />;
}
