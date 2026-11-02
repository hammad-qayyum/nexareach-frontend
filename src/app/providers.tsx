"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/client";
import { ME_QUERY_KEY } from "@/lib/session";

let browserQueryClient: QueryClient | undefined;

function makeQueryClient() {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError(error, query) {
        // A session can end mid-use (expired, or an admin changed this user's role).
        // Re-checking /me lets the auth gate send the user back to sign-in.
        if (error instanceof ApiError && error.status === 401 && query.queryKey[0] !== ME_QUERY_KEY[0]) {
          client.invalidateQueries({ queryKey: ME_QUERY_KEY });
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
    },
  });
  return client;
}

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          {children}
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
