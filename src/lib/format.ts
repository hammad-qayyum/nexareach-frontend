import { format, formatDistanceToNowStrict } from "date-fns";

export function formatDateTime(iso: string): string {
  return format(new Date(iso), "d MMM yyyy, HH:mm");
}

export function formatDate(iso: string): string {
  return format(new Date(iso), "d MMM yyyy");
}

export function formatRelative(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}
