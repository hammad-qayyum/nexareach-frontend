"use client";

import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  /** Smaller grey text after the label, also searched (an email address, a count…). */
  hint?: string;
  /** Draw a line under this option (after "All …", say). */
  divider?: boolean;
};

/** Above this many options the list gets a search box. */
const SEARCH_FROM = 8;

/**
 * A dropdown for lists that grow with the team's data (mailboxes, campaigns, groups…). Looks like the normal
 * Select; with more than a few options it opens with a search box. Arrow keys, Enter and Escape work.
 */
export function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Choose…",
  label,
  searchLabel = "Search",
  size = "default",
  className,
  disabled,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Accessible name when there's no visible <label for={id}>. */
  label?: string;
  searchLabel?: string;
  size?: "sm" | "default";
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const searchable = options.length > SEARCH_FROM;
  const selected = options.find((o) => o.value === value);
  const found = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(needle)) : options;
  }, [options, q]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (o: SelectOption) => {
    onValueChange(o.value);
    setOpen(false);
    setQ("");
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(found.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      setActive(0);
    } else if (e.key === "End") {
      setActive(found.length - 1);
    } else if (e.key === "Enter" && found[active]) {
      e.preventDefault();
      choose(found[active]);
    }
  };

  return (
    <PopoverPrimitive.Root
      modal
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setQ("");
        // Opening starts from the chosen option; typing starts from the first match.
        if (o) setActive(Math.max(0, options.findIndex((x) => x.value === value)));
      }}
    >
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={label}
          data-size={size}
          className={cn(
            "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] dark:bg-input/30 dark:hover:bg-input/50",
            className,
          )}
        >
          <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
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
                placeholder={searchLabel}
                aria-label={searchLabel}
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
            tabIndex={-1}
            onKeyDown={searchable ? undefined : onKeyDown}
            aria-activedescendant={!searchable && found[active] ? `${listId}-${active}` : undefined}
            className="max-h-72 overflow-y-auto outline-none"
          >
            {found.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">Nothing matches.</li>}
            {found.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className={cn(
                  "relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm select-none",
                  i === active && "bg-accent text-accent-foreground",
                  o.divider && !q && "mb-1 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-border",
                )}
              >
                <span className="min-w-0 truncate">
                  {o.label}
                  {o.hint && <span className="ml-1.5 text-xs text-muted-foreground">{o.hint}</span>}
                </span>
                {o.value === value && <CheckIcon className="absolute right-2 size-4" />}
              </li>
            ))}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
