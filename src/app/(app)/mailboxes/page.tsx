import type { Metadata } from "next";
import { MailboxesView } from "./mailboxes-view";

export const metadata: Metadata = { title: "Mailboxes" };

export default function MailboxesPage() {
  return <MailboxesView />;
}
