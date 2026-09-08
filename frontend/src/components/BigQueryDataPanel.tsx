import { useState } from "react";
import { api } from "../api";
import type { ColumnFilterType } from "./DataGrid";
import { DataGrid } from "./DataGrid";
import type { ColumnSchema, TableDataResponse } from "../types";

interface Props {
  tableId: string;
  schema: ColumnSchema[];
  defaultRowLimit: number;
  maxRowLimit: number;
}

function bqTypeToFilter(type: string): ColumnFilterType {
  if (["INTEGER", "INT64", "FLOAT", "FLOAT64", "NUMERIC", "BIGNUMERIC"].includes(type)) {
    return "number";
  }
  if (["DATE", "DATETIME", "TIMESTAMP", "TIME"].includes(type)) {
    return "date";
  }
  return "text";
}

export function BigQueryDataPanel({ tableId, schema, defaultRowLimit, maxRowLimit }: Props) {
  const [rowLimit, setRowLimit] = useState(defaultRowLimit);
  const [whereClause, setWhereClause] = useState("");
  const [orderBy, setOrderBy] = useState("");
  const [orderDir, setOrderDir] = useState<"ASC" | "DESC">("ASC");
  const [data, setData] = useState<TableDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columnTypes = Object.fromEntries(schema.map((c) => [c.name, bqTypeToFilter(c.type)]));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTableData({
        table_id: tableId,
        row_limit: rowLimit,
        where_clause: whereClause.trim() || undefined,
        order_by: orderBy.trim() || undefined,
        order_dir: orderDir,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Data</h2>

      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Row limit</label>
          <input
            type="number"
            min={1}
            max={maxRowLimit}
            value={rowLimit}
            onChange={(e) => setRowLimit(Number(e.target.value))}
            className="w-28 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-[var(--text-muted)] mb-1">
            SQL WHERE clause (optional, advanced)
          </label>
          <input
            type="text"
            value={whereClause}
            onChange={(e) => setWhereClause(e.target.value)}
            placeholder="e.g. status = 'active' AND created_at > '2026-01-01'"
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Order by</label>
          <input
            type="text"
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
            placeholder="column"
            className="w-36 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Direction</label>
          <select
            value={orderDir}
            onChange={(e) => setOrderDir(e.target.value as "ASC" | "DESC")}
            className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="ASC">ASC</option>
            <option value="DESC">DESC</option>
          </select>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load data"}
        </button>
      </div>

      {error && <p className="mb-3 text-xs text-[var(--danger)]">{error}</p>}

      {data && (
        <DataGrid
          rows={data.rows}
          columns={data.columns}
          columnTypes={columnTypes}
          exportFileBaseName={tableId.split(".").pop() ?? "data"}
          footerNote={`Loaded ${data.row_count.toLocaleString()} rows${
            data.truncated
              ? ` (capped at ${rowLimit.toLocaleString()} — raise the row limit to see more).`
              : "."
          }`}
        />
      )}
    </div>
  );
}
