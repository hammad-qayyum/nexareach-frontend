import type { Metadata } from "next";
import { DealsView } from "./deals-view";

export const metadata: Metadata = { title: "Deals" };

export default function DealsSettingsPage() {
  return <DealsView />;
}
