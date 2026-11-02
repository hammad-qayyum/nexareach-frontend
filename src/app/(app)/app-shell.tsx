"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ApiError } from "@/lib/api/client";
import { activeNavItem } from "@/lib/nav";
import { goToSignIn, SessionProvider, useMe } from "@/lib/session";

export function AppShell({ children }: { children: ReactNode }) {
  const { data, error } = useMe();
  const signedOut = error instanceof ApiError && error.status === 401;
  const needsMfa = data !== undefined && data.mfa !== "passed";

  useEffect(() => {
    if (signedOut || needsMfa) goToSignIn(window.location.pathname + window.location.search);
  }, [signedOut, needsMfa]);

  if (error && !signedOut) return <ShellError message={error.message} />;
  if (!data || needsMfa) return <ShellLoading />;

  return (
    <SessionProvider user={data.user}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <TopBar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}

function TopBar() {
  const pathname = usePathname();
  const item = activeNavItem(pathname);
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <span className="text-sm text-muted-foreground">{item?.title}</span>
    </header>
  );
}

function ShellLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center" aria-busy>
      <BrandMark className="animate-pulse" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

function ShellError({ message }: { message: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <BrandMark />
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </div>
  );
}
