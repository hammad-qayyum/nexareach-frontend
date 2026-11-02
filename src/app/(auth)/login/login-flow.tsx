"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { AuthCard, AuthCardSkeleton } from "@/components/auth/auth-card";
import { CodeForm } from "@/components/auth/code-form";
import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError, unwrap, type MfaState } from "@/lib/api/client";
import { safeNext, signOut, useMe } from "@/lib/session";

type Step = "credentials" | MfaState;

export function LoginFlow() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const me = useMe();
  const [step, setStep] = useState<Step | null>(null);

  // Someone who already signed in with a password but hasn't finished 2FA resumes at that step.
  const signedOut = me.error instanceof ApiError && me.error.status === 401;
  const current: Step | null = step ?? (me.data ? me.data.mfa : signedOut || me.isError ? "credentials" : null);

  useEffect(() => {
    // Full page load, so the signed-in app starts with a clean cache.
    if (current === "passed") window.location.replace(next);
  }, [current, next]);

  if (current === null || current === "passed") return <AuthCardSkeleton />;
  if (current === "credentials") {
    return <CredentialsStep defaultEmail={params.get("email") ?? ""} onDone={setStep} />;
  }
  if (current === "setup") return <SetupStep onDone={() => setStep("passed")} />;
  return <VerifyStep onDone={() => setStep("passed")} />;
}

function CredentialsStep({ defaultEmail, onDone }: { defaultEmail: string; onDone: (mfa: MfaState) => void }) {
  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) => unwrap(api.POST("/api/auth/login", { body })),
    onSuccess: (data) => onDone(data.mfa),
  });

  return (
    <AuthCard title="Sign in" description="Use your FastNexa account.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          login.mutate({ email: String(form.get("email")), password: String(form.get("password")) });
        }}
      >
        <FieldGroup>
          {login.error && (
            <Alert variant="destructive">
              <AlertDescription>{login.error.message}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              defaultValue={defaultEmail}
              autoFocus={!defaultEmail}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus={!!defaultEmail}
              required
            />
          </Field>
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}

function VerifyStep({ onDone }: { onDone: () => void }) {
  const verify = useMutation({
    mutationFn: (code: string) => unwrap(api.POST("/api/auth/2fa/verify", { body: { code } })),
    onSuccess: onDone,
  });

  return (
    <AuthCard
      title="2-step sign-in"
      description="Enter the 6-digit code from your authenticator app."
      footer={<SwitchAccount />}
    >
      <div className="grid gap-4">
        <CodeForm
          submitLabel="Continue"
          pending={verify.isPending}
          error={verify.error?.message}
          onSubmit={(code) => verify.mutate(code)}
        />
        <p className="text-center text-xs text-muted-foreground">
          Lost your authenticator? Ask an admin to reset your 2-step sign-in.
        </p>
      </div>
    </AuthCard>
  );
}

function SetupStep({ onDone }: { onDone: () => void }) {
  // A query rather than a mutation so the secret is created once, even if React renders twice.
  const setup = useQuery({
    queryKey: ["totp-setup"],
    queryFn: () => unwrap(api.POST("/api/auth/2fa/setup")),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const enable = useMutation({
    mutationFn: (code: string) => unwrap(api.POST("/api/auth/2fa/enable", { body: { code } })),
    onSuccess: onDone,
  });

  return (
    <AuthCard
      title="Set up 2-step sign-in"
      description="Admins sign in with a code from an authenticator app as well as a password."
      footer={<SwitchAccount />}
    >
      {setup.error ? (
        <Alert variant="destructive">
          <AlertDescription>{setup.error.message}</AlertDescription>
        </Alert>
      ) : (
        <ol className="grid gap-6 text-sm">
          <SetupItem n={1} title="Install an authenticator app">
            For example Google Authenticator, Microsoft Authenticator or 1Password.
          </SetupItem>
          <SetupItem n={2} title="Scan this code with the app">
            {setup.data ? (
              <div className="mt-3 grid gap-3">
                <div className="w-fit rounded-lg border bg-white p-3">
                  <QRCodeSVG value={setup.data.otpauth_uri} size={152} marginSize={0} title="Authenticator QR code" />
                </div>
                <SecretKey secret={setup.data.secret} />
              </div>
            ) : (
              <div className="mt-3 size-44 animate-pulse rounded-lg bg-muted" />
            )}
          </SetupItem>
          <SetupItem n={3} title="Enter the code the app shows">
            <div className="mt-3">
              <CodeForm
                submitLabel="Turn on and continue"
                pending={enable.isPending || !setup.data}
                error={enable.error?.message}
                onSubmit={(code) => enable.mutate(code)}
              />
            </div>
          </SetupItem>
        </ol>
      )}
    </AuthCard>
  );
}

function SetupItem({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_1fr] gap-x-3">
      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
        {n}
      </span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

function SecretKey({ secret }: { secret: string }) {
  const grouped = secret.match(/.{1,4}/g)?.join(" ") ?? secret;
  return (
    <div className="grid gap-1">
      <span className="text-xs">Can&apos;t scan it? Enter this key instead:</span>
      <div className="flex items-center gap-1">
        <code className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1.5 font-mono text-xs break-all text-foreground">
          {grouped}
        </code>
        <CopyButton value={secret} label="Copy key" />
      </div>
    </div>
  );
}

function SwitchAccount() {
  return (
    <button type="button" className="underline-offset-4 hover:text-foreground hover:underline" onClick={() => signOut()}>
      Use a different account
    </button>
  );
}
