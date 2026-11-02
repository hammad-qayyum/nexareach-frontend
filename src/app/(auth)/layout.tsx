import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-10">
      <Brand />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
