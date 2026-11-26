"use client";

import { ChevronDownIcon, ChevronUpIcon, SearchIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Helpers for lists that grow with the team's data (mailboxes, campaigns, groups, alerts…), so a page stays
 * readable with 5 items or 500.
 */

/** "a, b, c and 12 more" */
export function nameList(names: string[], max = 3): string {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

/** The first `limit` items, or all of them once the person asks. */
export function useShowMore<T>(items: T[], limit: number) {
  const [all, setAll] = useState(false);
  return {
    shown: all ? items : items.slice(0, limit),
    hidden: Math.max(0, items.length - limit),
    all,
    toggle: () => setAll((v) => !v),
  };
}

export function ShowMoreButton({
  hidden,
  all,
  onToggle,
  noun = "more",
  className,
}: {
  hidden: number;
  all: boolean;
  onToggle: () => void;
  noun?: string;
  className?: string;
}) {
  if (hidden <= 0) return null;
  return (
    <Button variant="ghost" size="sm" className={cn("w-fit text-muted-foreground", className)} onClick={onToggle}>
      {all ? (
        <>
          <ChevronUpIcon data-icon="inline-start" /> Show fewer
        </>
      ) : (
        <>
          <ChevronDownIcon data-icon="inline-start" /> Show {hidden.toLocaleString()} {noun}
        </>
      )}
    </Button>
  );
}

/** Items one page at a time, for lists the server sends in full. */
export function usePaged<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  return {
    page: current,
    setPage,
    shown: items.slice((current - 1) * pageSize, current * pageSize),
    pageSize,
    total: items.length,
  };
}

/** Case-insensitive filter over a few text fields. */
export function useSearch<T>(items: T[], text: (item: T) => string) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const found = useMemo(
    () => (needle ? items.filter((i) => text(i).toLowerCase().includes(needle)) : items),
    // `text` is a plain accessor written inline by the caller; the list and the query decide the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, needle],
  );
  return { q, setQ, found };
}

export function SearchBox({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="h-8 pl-8"
      />
    </div>
  );
}

/**
 * A tick-list that stays small: a search box once there are more than a handful of items, a scrolling box,
 * and a count of what is ticked with "select all shown" / "clear".
 */
export function PickList<T extends { id: number }>({
  items,
  selected,
  onChange,
  text,
  render,
  noun,
  disabled,
  empty,
}: {
  items: T[];
  selected: number[];
  onChange: (ids: number[]) => void;
  text: (item: T) => string;
  render: (item: T, checked: boolean) => ReactNode;
  noun: string;
  disabled?: boolean;
  empty?: ReactNode;
}) {
  const { q, setQ, found } = useSearch(items, text);
  if (items.length === 0) return <>{empty}</>;
  const big = items.length > 8;
  const chosen = new Set(selected);
  const allShownChosen = found.length > 0 && found.every((i) => chosen.has(i.id));
  return (
    <div className="grid gap-2">
      {big && <SearchBox value={q} onChange={setQ} label={`Search ${noun}`} />}
      <div className={cn("grid content-start gap-2", big && "relative max-h-72 overflow-y-auto rounded-md border p-2")}>
        {found.length ? found.map((i) => render(i, chosen.has(i.id))) : <p className="text-sm text-muted-foreground">Nothing matches.</p>}
      </div>
      {big && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {selected.length.toLocaleString()} of {items.length.toLocaleString()} {noun} ticked
          </span>
          {!disabled && (
            <>
              <button
                type="button"
                className="underline-offset-4 hover:underline"
                onClick={() =>
                  onChange(
                    allShownChosen
                      ? selected.filter((id) => !found.some((i) => i.id === id))
                      : [...new Set([...selected, ...found.map((i) => i.id)])],
                  )
                }
              >
                {allShownChosen ? "Untick" : "Tick"} {q ? "the matches" : "all"}
              </button>
              {selected.length > 0 && (
                <button type="button" className="underline-offset-4 hover:underline" onClick={() => onChange([])}>
                  Clear
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Renders the first `limit` items through `children`, with "show N more" underneath. */
export function Limited<T>({
  items,
  limit,
  noun,
  buttonClassName,
  children,
}: {
  items: T[];
  limit: number;
  noun?: string;
  buttonClassName?: string;
  children: (shown: T[]) => ReactNode;
}) {
  const more = useShowMore(items, limit);
  return (
    <>
      {children(more.shown)}
      <ShowMoreButton hidden={more.hidden} all={more.all} onToggle={more.toggle} noun={noun} className={buttonClassName} />
    </>
  );
}
