"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, unwrap } from "@/lib/api/client";
import { canEdit, useCurrentUser } from "@/lib/session";

export const FOOTER_QUERY_KEY = ["settings", "footer"] as const;

export function SettingsView() {
  const footer = useQuery({ queryKey: FOOTER_QUERY_KEY, queryFn: () => unwrap(api.GET("/api/settings/footer")) });

  return (
    <div className="grid gap-6">
      <PageHeader title="Settings" description="Your business details, to use in emails." />
      {footer.error ? (
        <QueryError error={footer.error} onRetry={() => footer.refetch()} />
      ) : footer.isPending ? (
        <Skeleton className="h-72 max-w-2xl" />
      ) : (
        <FooterForm key={`${footer.data.business_name}|${footer.data.postal_address}`} initial={footer.data} />
      )}
    </div>
  );
}

function FooterForm({ initial }: { initial: { business_name: string; postal_address: string } }) {
  const me = useCurrentUser();
  const editable = canEdit(me.role);
  const queryClient = useQueryClient();
  const [businessName, setBusinessName] = useState(initial.business_name);
  const [address, setAddress] = useState(initial.postal_address);
  const save = useMutation({
    mutationFn: () =>
      unwrap(api.PUT("/api/settings/footer", { body: { business_name: businessName, postal_address: address } })),
    onSuccess: (data) => {
      queryClient.setQueryData(FOOTER_QUERY_KEY, data);
      toast.success("Business details saved.");
    },
    onError: (e) => toast.error(e.message),
  });
  const unchanged = businessName === initial.business_name && address === initial.postal_address;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Business details</CardTitle>
        <CardDescription>
          Nothing is added to your emails automatically. To include these, type{" "}
          <code className="font-mono text-xs">{"{{business_name}}"}</code> or{" "}
          <code className="font-mono text-xs">{"{{postal_address}}"}</code> in a message. Emails to people in the US
          or Canada must include a postal address and a way to opt out.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="business-name">Business name</FieldLabel>
            <Input
              id="business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              maxLength={200}
              disabled={!editable}
              placeholder="FastNexa"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="postal-address">Postal address</FieldLabel>
            <Textarea
              id="postal-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={!editable}
              placeholder="Office 4, 12 Main Boulevard, Lahore, Pakistan"
            />
            <FieldDescription>Keep it to one or two lines.</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      {editable && (
        <CardFooter className="justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending || unchanged}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
