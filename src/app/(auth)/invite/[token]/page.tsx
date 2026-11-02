import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/auth/auth-card";
import { AcceptInvite } from "./accept-invite";

export const metadata: Metadata = { title: "Accept invite" };

export default function InvitePage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <AcceptInvite />
    </Suspense>
  );
}
