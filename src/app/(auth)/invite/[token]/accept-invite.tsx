"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AuthCard, AuthCardSkeleton } from "@/components/auth/auth-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, unwrap } from "@/lib/api/client";

// Matches MIN_PASSWORD_LENGTH in the backend.
const MIN_PASSWORD_LENGTH = 10;

export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const [mismatch, setMismatch] = useState(false);

  const invite = useQuery({
    queryKey: ["invite", token],
    queryFn: () => unwrap(api.GET("/api/auth/invites/{token}", { params: { path: { token } } })),
    retry: false,
  });
  const accept = useMutation({
    mutationFn: (password: string) =>
      unwrap(api.POST("/api/auth/invites/{token}/accept", { params: { path: { token } }, body: { password } })),
    onSuccess: () => {
      window.location.replace(`/login?email=${encodeURIComponent(invite.data?.email ?? "")}`);
    },
  });

  if (invite.isPending) return <AuthCardSkeleton />;
  if (invite.error) {
    return (
      <AuthCard title="Invite not valid" footer={<Link href="/login">Go to sign in</Link>}>
        <p className="text-sm text-muted-foreground">{invite.error.message}</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Welcome, ${invite.data.name}`}
      description={
        <>
          Choose a password for <span className="font-medium text-foreground">{invite.data.email}</span>.
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const password = String(form.get("password"));
          const ok = password === String(form.get("confirm"));
          setMismatch(!ok);
          if (ok) accept.mutate(password);
        }}
      >
        <FieldGroup>
          {accept.error && (
            <Alert variant="destructive">
              <AlertDescription>{accept.error.message}</AlertDescription>
            </Alert>
          )}
          {/* Lets password managers save the login against the right email. */}
          <input type="hidden" name="username" autoComplete="username" value={invite.data.email} />
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={200}
              autoFocus
              required
            />
            <FieldDescription>At least {MIN_PASSWORD_LENGTH} characters.</FieldDescription>
          </Field>
          <Field data-invalid={mismatch || undefined}>
            <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={mismatch || undefined}
              required
            />
            {mismatch && <FieldError>The passwords don&apos;t match.</FieldError>}
          </Field>
          <Button type="submit" disabled={accept.isPending}>
            {accept.isPending ? "Saving…" : "Set password"}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
