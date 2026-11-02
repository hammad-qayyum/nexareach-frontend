"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";

const CODE_LENGTH = 6;

/** Six-digit authenticator code. Submits by itself once all digits are in. */
export function CodeForm({
  submitLabel,
  pending,
  error,
  onSubmit,
}: {
  submitLabel: string;
  pending: boolean;
  error?: string;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");

  function submit(value: string) {
    if (value.length === CODE_LENGTH && !pending) onSubmit(value);
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(code);
      }}
    >
      <Field data-invalid={!!error || undefined}>
        <FieldLabel htmlFor="code">Authenticator code</FieldLabel>
        <InputOTP
          id="code"
          maxLength={CODE_LENGTH}
          pattern={REGEXP_ONLY_DIGITS}
          value={code}
          onChange={(value) => {
            setCode(value);
            submit(value);
          }}
          disabled={pending}
          autoFocus
          autoComplete="one-time-code"
          containerClassName="justify-center"
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <Button type="submit" disabled={pending || code.length < CODE_LENGTH}>
        {pending ? "Checking…" : submitLabel}
      </Button>
    </form>
  );
}
