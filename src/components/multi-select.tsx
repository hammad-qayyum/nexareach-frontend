"use client";

import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type MultiOption = { value: string; label: string; hint?: string };

/** Above this many options the list gets a search box. */
const SEARCH_FROM = 8;

/**
 * A dropdown where several options can be ticked. Shows "All …" when none are, the one name when one is,
 * and "3 actions" when more. Search, arrow keys, Space/Enter to tick, Escape to close.
 */
export function MultiSelect({
  id,
  values,
  onChange,
  options,
  noun,
  allLabel,
  label,
  className,
}: {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiOption[];
  /** Plural, for "3 campaigns". */
  noun: string;
  /** Shown when nothing is ticked, e.g. "All campaigns". */
  allLabel: string;
  /** Accessible name when there's no visible <label for={id}>. */
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const searchable = options.length > SEARCH_FROM;
  const chosen = new Set(values);
  const found = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(needle)) : options;
  }, [options, q]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const toggle = (value: string) =>
    onChange(chosen.has(value) ? values.filter((v) => v !== value) : [...values, value]);
  const allFoundChosen = found.length > 0 && found.every((o) => chosen.has(o.value));
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(found.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if ((e.key === "Enter" || (e.key === " " && !searchable)) && found[active]) {
      e.preventDefault();
      toggle(found[active].value);
    }
  };

  const one = values.length === 1 ? options.find((o) => o.value === values[0]) : undefined;
  const summary = values.length === 0 ? allLabel : one ? one.label : `${values.length} ${noun}`;

  return (
    <PopoverPrimitive.Root
      modal
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setQ("");
        if (o) setActive(0);
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={label}
          className={cn(
            "flex h-8 w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
            className,
          )}
        >
          <span className={cn("min-w-0 truncate", values.length === 0 && "text-muted-foreground")}>{summary}</span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 grid w-(--radix-popover-trigger-width) min-w-64 max-w-[min(28rem,calc(100vw-2rem))] gap-1 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          onOpenAutoFocus={(e) => {
            if (!searchable) {
              e.preventDefault();
              listRef.current?.focus();
            }
          }}
        >
          {searchable && (
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={`Search ${noun}`}
                aria-label={`Search ${noun}`}
                aria-controls={listId}
                aria-activedescendant={found[active] ? `${listId}-${active}` : undefined}
                className="h-8 w-full rounded-md border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable
            tabIndex={-1}
            onKeyDown={searchable ? undefined : onKeyDown}
            aria-activedescendant={!searchable && found[active] ? `${listId}-${active}` : undefined}
            className="max-h-72 overflow-y-auto outline-none"
          >
            {found.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">Nothing matches.</li>}
            {found.map((o, i) => {
              const on = chosen.has(o.value);
              return (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={on}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(o.value)}
                  className={cn(
                    "flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-sm select-none",
                    i === active && "bg-accent text-accent-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input",
                      on && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {on && <CheckIcon className="size-3" />}
                  </span>
                  <span className="min-w-0 truncate">
                    {o.label}
                    {o.hint && <span className="ml-1.5 text-xs text-muted-foreground">{o.hint}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t px-2 pt-1.5 pb-0.5 text-xs text-muted-foreground">
            <span className="tabular-nums">{values.length ? `${values.length} ticked` : "None ticked = all"}</span>
            <span className="flex gap-3">
              {found.length > 0 && (
                <button
                  type="button"
                  className="underline-offset-4 hover:underline"
                  onClick={() =>
                    onChange(
                      allFoundChosen
                        ? values.filter((v) => !found.some((o) => o.value === v))
                        : [...new Set([...values, ...found.map((o) => o.value)])],
                    )
                  }
                >
                  {allFoundChosen ? "Untick" : "Tick"} {q ? "matches" : "all"}
                </button>
              )}
              {values.length > 0 && (
                <button type="button" className="underline-offset-4 hover:underline" onClick={() => onChange([])}>
                  Clear
                </button>
              )}
            </span>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
