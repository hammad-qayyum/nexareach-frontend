import type { Metadata } from "next";
import { ScoringView } from "./scoring-view";

export const metadata: Metadata = { title: "Reply score" };

export default function ScoringPage() {
  return <ScoringView />;
}
