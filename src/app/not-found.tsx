import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <BrandMark />
      <div className="grid gap-1">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">That address doesn&apos;t match any page.</p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/">Go to the dashboard</Link>
      </Button>
    </div>
  );
}
