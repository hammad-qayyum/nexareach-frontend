"use client";

import { Columns3Icon } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Columns of the leads table someone can hide. Email and name always show. */
export const BUILT_IN = [
  { id: "company", label: "Company" },
  { id: "country", label: "Country" },
  { id: "timezone", label: "Timezone" },
  { id: "provider", label: "Provider" },
] as const;

/** Extra fields get their own ids so "company" the column and an extra field named company_2 never clash. */
export const extraId = (key: string) => `x:${key}`;

/** "job_title" → "Job title" */
export function fieldLabel(key: string): string {
  const words = key.replace(/_+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Which columns are hidden, remembered on this browser. Kept in memory too, so it still works when the
// browser blocks storage (private windows).
const STORAGE_KEY = "nexareach.leads.hiddenColumns";
const listeners = new Set<() => void>();
let memory: string | null = null;

function read(): string {
  if (memory !== null) return memory;
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function useHiddenColumns() {
  const raw = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read,
    () => "[]",
  );
  const hidden = useMemo(() => {
    try {
      const value: unknown = JSON.parse(raw);
      return new Set(Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);
  const setShown = (id: string, shown: boolean) => {
    const next = new Set(hidden);
    if (shown) next.delete(id);
    else next.add(id);
    memory = JSON.stringify([...next]);
    try {
      localStorage.setItem(STORAGE_KEY, memory);
    } catch {
      // Storage blocked: the choice lasts until the page is reloaded.
    }
    listeners.forEach((l) => l());
  };
  return { hidden, setShown };
}

export function ColumnsMenu({
  extraKeys,
  hidden,
  setShown,
}: {
  extraKeys: string[];
  hidden: Set<string>;
  setShown: (id: string, shown: boolean) => void;
}) {
  const item = (id: string, label: string) => (
    <DropdownMenuCheckboxItem
      key={id}
      checked={!hidden.has(id)}
      onCheckedChange={(v) => setShown(id, v === true)}
      // Stay open, so several columns can be switched in one go.
      onSelect={(e) => e.preventDefault()}
    >
      {label}
    </DropdownMenuCheckboxItem>
  );
  const hiddenCount = BUILT_IN.filter((c) => hidden.has(c.id)).length + extraKeys.filter((k) => hidden.has(extraId(k))).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Columns3Icon data-icon="inline-start" /> Columns
          {hiddenCount > 0 && <span className="text-muted-foreground">({hiddenCount} hidden)</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 min-w-52 overflow-y-auto">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        {BUILT_IN.map((c) => item(c.id, c.label))}
        {extraKeys.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Extra fields</DropdownMenuLabel>
            {extraKeys.map((k) => item(extraId(k), fieldLabel(k)))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** An extra field's heading, styled like the others; hovering shows how to use it in an email. */
export function ExtraFieldHeading({ fieldKey }: { fieldKey: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="cursor-help outline-none focus-visible:underline">
          {fieldLabel(fieldKey)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Use in emails as <span className="font-mono">{`{{${fieldKey}}}`}</span>
      </TooltipContent>
    </Tooltip>
  );
}
