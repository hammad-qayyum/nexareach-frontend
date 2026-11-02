import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Warm-up" };

export default function Page() {
  return <ComingSoon href="/warmup" />;
}
