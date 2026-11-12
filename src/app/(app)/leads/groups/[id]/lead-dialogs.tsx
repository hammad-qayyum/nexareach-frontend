"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, type Group, type Lead, unwrap } from "@/lib/api/client";

export const PROVIDER_LABELS: Record<string, string> = {
  GOOGLE: "Google",
  MICROSOFT: "Microsoft",
  OTHER: "Other",
  UNKNOWN: "No mail server",
  PENDING: "Not checked",
};

type LeadFields = { first_name: string; last_name: string; company: string; country: string; timezone: string };

function LeadFieldInputs({ v, set }: { v: LeadFields; set: (k: keyof LeadFields, value: string) => void }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="lead-first">First name</FieldLabel>
          <Input id="lead-first" value={v.first_name} onChange={(e) => set("first_name", e.target.value)} maxLength={200} />
        </Field>
        <Field>
          <FieldLabel htmlFor="lead-last">Last name</FieldLabel>
          <Input id="lead-last" value={v.last_name} onChange={(e) => set("last_name", e.target.value)} maxLength={200} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="lead-company">Company</FieldLabel>
        <Input id="lead-company" value={v.company} onChange={(e) => set("company", e.target.value)} maxLength={300} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="lead-country">Country</FieldLabel>
          <Input id="lead-country" value={v.country} onChange={(e) => set("country", e.target.value)} maxLength={100} />
        </Field>
        <Field>
          <FieldLabel htmlFor="lead-tz">Timezone</FieldLabel>
          <Input
            id="lead-tz"
            value={v.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            placeholder="From the country"
            maxLength={64}
          />
          <FieldDescription>For example Asia/Dubai. Leave empty to work it out from the country.</FieldDescription>
        </Field>
      </div>
    </>
  );
}

function fromLead(lead: Lead | null): LeadFields {
  return {
    first_name: lead?.first_name ?? "",
    last_name: lead?.last_name ?? "",
    company: lead?.company ?? "",
    country: lead?.country ?? "",
    timezone: lead?.timezone ?? "",
  };
}

export function AddLeadDialog({
  groupId,
  open,
  onOpenChange,
  onDone,
}: {
  groupId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <AddLeadForm groupId={groupId} onCancel={() => onOpenChange(false)} onDone={onDone} />}</DialogContent>
    </Dialog>
  );
}

function AddLeadForm({ groupId, onCancel, onDone }: { groupId: number; onCancel: () => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [v, setV] = useState<LeadFields>(fromLead(null));
  const add = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/groups/{group_id}/leads", {
          params: { path: { group_id: groupId } },
          body: { email, ...v, timezone: v.timezone || null, custom: {} },
        }),
      ),
    onSuccess: (r) => {
      if (r.pending_duplicate) toast.warning(`${email} is already in the system. It's waiting on the Duplicates page.`);
      else toast.success(`Added ${r.lead?.email}.`);
      onDone();
    },
  });
  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>Add a lead</DialogTitle>
        <DialogDescription>If the email is already in the system, it goes to Duplicates for review.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        {add.error && (
          <Alert variant="destructive">
            <AlertDescription>{add.error.message}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="lead-email">Email</FieldLabel>
          <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <LeadFieldInputs v={v} set={(k, value) => setV((s) => ({ ...s, [k]: value }))} />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? "Adding…" : "Add lead"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditLeadDialog({
  lead,
  onOpenChange,
  onDone,
}: {
  lead: Lead | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  return (
    <Dialog open={!!lead} onOpenChange={onOpenChange}>
      <DialogContent>{lead && <EditLeadForm key={lead.id} lead={lead} onCancel={() => onOpenChange(false)} onDone={onDone} />}</DialogContent>
    </Dialog>
  );
}

function EditLeadForm({ lead, onCancel, onDone }: { lead: Lead; onCancel: () => void; onDone: () => void }) {
  const [v, setV] = useState<LeadFields>(fromLead(lead));
  const save = useMutation({
    mutationFn: () =>
      unwrap(api.PATCH("/api/leads/{lead_id}", { params: { path: { lead_id: lead.id } }, body: v })),
    onSuccess: () => {
      toast.success(`Saved ${lead.email}.`);
      onDone();
    },
  });
  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit {lead.email}</DialogTitle>
        <DialogDescription>
          Changes apply in every group this lead is in. Campaigns already started keep the text they sent.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        {save.error && (
          <Alert variant="destructive">
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
        <LeadFieldInputs v={v} set={(k, value) => setV((s) => ({ ...s, [k]: value }))} />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RenameGroupDialog({
  group,
  open,
  onOpenChange,
  onDone,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <RenameForm group={group} onCancel={() => onOpenChange(false)} onDone={onDone} />}</DialogContent>
    </Dialog>
  );
}

function RenameForm({ group, onCancel, onDone }: { group: Group; onCancel: () => void; onDone: () => void }) {
  const [name, setName] = useState(group.name);
  const [source, setSource] = useState(group.source ?? "");
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PATCH("/api/groups/{group_id}", {
          params: { path: { group_id: group.id } },
          body: { name, source: source || null },
        }),
      ),
    onSuccess: () => {
      toast.success("Group saved.");
      onDone();
    },
  });
  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename group</DialogTitle>
      </DialogHeader>
      <FieldGroup>
        {save.error && (
          <Alert variant="destructive">
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="group-rename">Name</FieldLabel>
          <Input id="group-rename" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="group-source-edit">Where the leads came from</FieldLabel>
          <Input id="group-source-edit" value={source} onChange={(e) => setSource(e.target.value)} maxLength={200} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending || !name.trim()}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
