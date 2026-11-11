import type { Metadata } from "next";
import { DncView } from "./dnc-view";

export const metadata: Metadata = { title: "Do not contact" };

export default function DncPage() {
  return <DncView />;
}
