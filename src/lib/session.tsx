"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { api, unwrap, type Role, type User } from "@/lib/api/client";

export const ME_QUERY_KEY = ["me"] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => unwrap(api.GET("/api/auth/me")),
    retry: false,
  });
}

const SessionContext = createContext<User | null>(null);

export function SessionProvider({ user, children }: { user: User; children: ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** The signed-in user (who has passed 2FA). Only available inside the signed-in layout. */
export function useCurrentUser(): User {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useCurrentUser must be used inside the signed-in layout");
  return user;
}

// The backend enforces these on every request; the UI only uses them to hide what a role can't use.
export const isAdmin = (role: Role) => role === "ADMIN";
export const canEdit = (role: Role) => role === "ADMIN" || role === "MEMBER";

export const ROLE_LABELS: Record<Role, string> = { ADMIN: "Admin", MEMBER: "Member", VIEWER: "Viewer" };

/** Only same-site paths, so a crafted ?next= can't send the user to another site. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

// Crossing the sign-in boundary uses full page loads so no cached data or page state survives.
export function goToSignIn(next?: string) {
  const query = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  window.location.replace(`/login${query}`);
}

export async function signOut() {
  await api.POST("/api/auth/logout").catch(() => undefined);
  window.location.replace("/login");
}
