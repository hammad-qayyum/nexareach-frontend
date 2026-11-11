import type { Metadata } from "next";
import { ImportView } from "./import-view";

export const metadata: Metadata = { title: "Import leads" };

export default function ImportPage() {
  return <ImportView />;
}
