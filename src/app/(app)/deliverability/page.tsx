import type { Metadata } from "next";
import { DeliverabilityView } from "./deliverability-view";

export const metadata: Metadata = { title: "Deliverability" };

export default function DeliverabilityPage() {
  return <DeliverabilityView />;
}
