import type { TableInfo } from "../types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

export function TableInfoPanel({ info }: { info: TableInfo }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-[var(--text)] font-mono">{info.table_id}</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Rows" value={info.num_rows?.toLocaleString() ?? "—"} />
        <Stat label="Size" value={info.size_human ?? "—"} />
        <Stat label="Created" value={formatDate(info.created)} />
        <Stat label="Last modified" value={formatDate(info.last_modified)} />
      </div>

      {info.description && (
        <p className="text-sm text-[var(--text-muted)] mb-4">{info.description}</p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--text)] font-medium mb-2">
          Schema ({info.schema.length} columns)
        </summary>
        <div className="overflow-x-auto mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-[var(--text-muted)] sticky top-0 bg-[var(--surface)]">
              <tr className="text-left">
                <th className="py-1 pr-3 font-medium">Column</th>
                <th className="py-1 pr-3 font-medium">Type</th>
                <th className="py-1 pr-3 font-medium">Mode</th>
                <th className="py-1 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {info.schema.map((col) => (
                <tr key={col.name} className="border-t border-[var(--border)]">
                  <td className="py-1 pr-3 font-mono text-[var(--text)]">{col.name}</td>
                  <td className="py-1 pr-3 text-[var(--text-muted)]">{col.type}</td>
                  <td className="py-1 pr-3 text-[var(--text-muted)]">{col.mode}</td>
                  <td className="py-1 text-[var(--text-muted)]">{col.description ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="text-sm font-medium text-[var(--text)]">{value}</div>
    </div>
  );
}
