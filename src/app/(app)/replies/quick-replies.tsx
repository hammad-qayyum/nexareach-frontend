"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, type Schemas, unwrap } from "@/lib/api/client";

type QuickReply = Schemas["QuickReplyOut"];

const QUICK_REPLIES_KEY = ["quick-replies"] as const;
const VARIABLE = /\{\{\s*([A-Za-z0-9_]+)\s*(?:\|([^{}]*))?\}\}/g;

/** Fill {{variables}} (with optional |fallbacks) from the lead's fields, like campaign emails do. */
export function fillTemplate(text: string, fields: Record<string, string>): string {
  return text.replace(VARIABLE, (_, name: string, fallback?: string) => fields[name] || (fallback ?? "").trim());
}

const EMPTY = { title: "", body: "" };

/** Add, edit and delete the saved answers shared by the whole team. */
export function QuickRepliesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<QuickReply | "new" | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const list = useQuery({ queryKey: QUICK_REPLIES_KEY, queryFn: () => unwrap(api.GET("/api/quick-replies")) });
  const done = (message: string) => {
    queryClient.invalidateQueries({ queryKey: QUICK_REPLIES_KEY });
    setEditing(null);
    setForm(EMPTY);
    toast.success(message);
  };
  const save = useMutation({
    mutationFn: () =>
      editing === "new"
        ? unwrap(api.POST("/api/quick-replies", { body: form }))
        : unwrap(
            api.PUT("/api/quick-replies/{quick_reply_id}", {
              params: { path: { quick_reply_id: (editing as QuickReply).id } },
              body: form,
            }),
          ),
    onSuccess: () => done(editing === "new" ? "Quick reply added." : "Quick reply saved."),
  });
  const remove = useMutation({
    mutationFn: (id: number) =>
      unwrap(api.DELETE("/api/quick-replies/{quick_reply_id}", { params: { path: { quick_reply_id: id } } })),
    onSuccess: () => {
      setConfirmDelete(null);
      done("Quick reply deleted.");
    },
    onError: (e) => toast.error(e.message),
  });

  function startEdit(target: QuickReply | "new") {
    setEditing(target);
    setForm(target === "new" ? EMPTY : { title: target.title, body: target.body });
    save.reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setEditing(null);
          setConfirmDelete(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Quick replies</DialogTitle>
          <DialogDescription>
            Saved answers the whole team can insert with one click. Fields like{" "}
            <code className="font-mono text-xs">{"{{first_name|there}}"}</code> and{" "}
            <code className="font-mono text-xs">{"{{sender_name}}"}</code> are filled in for each person.
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="qr-title">Name</FieldLabel>
                <Input
                  id="qr-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={100}
                  placeholder="Send the price list"
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="qr-body">Answer</FieldLabel>
                <Textarea
                  id="qr-body"
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  rows={7}
                  maxLength={20_000}
                  className="leading-relaxed"
                  placeholder={"Hi {{first_name|there}},\n\n…\n\nBest regards,\n{{sender_name}}"}
                  required
                />
                <FieldDescription>Plain text. You can still change it before sending.</FieldDescription>
              </Field>
            </FieldGroup>
            {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Back
              </Button>
              <Button type="submit" disabled={save.isPending || !form.title.trim() || !form.body.trim()}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid gap-3">
            {list.isPending ? (
              <Skeleton className="h-32" />
            ) : list.data?.length ? (
              <ul className="grid max-h-[50vh] divide-y overflow-y-auto rounded-lg border">
                {list.data.map((qr) => (
                  <li key={qr.id} className="flex items-start gap-2 p-3">
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-sm font-medium">{qr.title}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{qr.body.replace(/\s+/g, " ")}</span>
                    </div>
                    {confirmDelete === qr.id ? (
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="destructive" onClick={() => remove.mutate(qr.id)} disabled={remove.isPending}>
                          Delete
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                          Keep
                        </Button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon-sm" variant="ghost" onClick={() => startEdit(qr)} aria-label={`Edit ${qr.title}`}>
                          <PencilIcon />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => setConfirmDelete(qr.id)} aria-label={`Delete ${qr.title}`}>
                          <Trash2Icon />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No quick replies yet.
              </p>
            )}
            <Button variant="outline" className="w-fit" onClick={() => startEdit("new")}>
              <PlusIcon data-icon="inline-start" /> Add a quick reply
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
