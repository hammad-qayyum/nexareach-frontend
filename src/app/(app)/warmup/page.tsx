import type { Metadata } from "next";
import { WarmupView } from "./warmup-view";

export const metadata: Metadata = { title: "Warm-up" };

export default function WarmupPage() {
  return <WarmupView />;
}
