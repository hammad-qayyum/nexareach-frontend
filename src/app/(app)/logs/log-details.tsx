import type { ActivityLog } from "@/lib/api/client";

function show(value: unknown): string {
  if (value === undefined) return "";
  if (value === null) return "empty";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Before/after values for one entry, field by field. */
export function LogDetails({ log }: { log: ActivityLog }) {
  const before = log.before ?? {};
  const after = log.after ?? {};
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const hasBefore = log.before !== null;

  return (
    <div className="grid gap-4 text-sm">
      {fields.length > 0 ? (
        <table className="w-full max-w-3xl table-fixed border-separate border-spacing-0 overflow-hidden rounded-md border bg-background">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-40 border-b px-3 py-2 font-medium">Field</th>
              {hasBefore && <th className="border-b px-3 py-2 font-medium">Before</th>}
              <th className="border-b px-3 py-2 font-medium">{hasBefore ? "After" : "Value"}</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {fields.map((field) => (
              <tr key={field} className="[&:not(:last-child)>td]:border-b">
                <td className="px-3 py-2 font-sans text-muted-foreground">{field}</td>
                {hasBefore && (
                  <td className="px-3 py-2 break-words text-muted-foreground">
                    {show(before[field])}
                  </td>
                )}
                <td className="px-3 py-2 break-words">{show(after[field])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted-foreground">No field changes recorded for this action.</p>
      )}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Entry</dt>
        <dd className="font-mono">#{log.id}</dd>
        <dt className="text-muted-foreground">Actor</dt>
        <dd>
          {log.actor_label}
          {log.actor_type !== "USER" && <span className="text-muted-foreground"> (not signed in or system)</span>}
        </dd>
        {log.user_agent && (
          <>
            <dt className="text-muted-foreground">Browser</dt>
            <dd className="break-all text-muted-foreground">{log.user_agent}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
