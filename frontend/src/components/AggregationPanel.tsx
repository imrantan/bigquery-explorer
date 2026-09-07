import { useRef, useState } from "react";
import type { ColumnFilterType } from "./DataGrid";
import { DataGrid } from "./DataGrid";

type AggFn = "sum" | "avg" | "count" | "min" | "max";

interface AggSpec {
  id: string;
  column: string;
  fn: AggFn;
}

interface Props {
  columns: string[];
  columnTypes?: Record<string, ColumnFilterType>;
  getRows: () => Record<string, unknown>[];
  exportFileBaseName: string;
}

const FN_LABELS: Record<AggFn, string> = {
  sum: "Sum",
  avg: "Average",
  count: "Count",
  min: "Min",
  max: "Max",
};

function numericColumns(columns: string[], columnTypes?: Record<string, ColumnFilterType>): string[] {
  if (!columnTypes) return columns;
  const nums = columns.filter((c) => columnTypes[c] === "number");
  return nums.length > 0 ? nums : columns;
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function computeAggregation(
  rows: Record<string, unknown>[],
  groupByCols: string[],
  specs: AggSpec[]
): { columns: string[]; rows: Record<string, unknown>[] } {
  const specLabels = specs.map((s) => `${FN_LABELS[s.fn]}(${s.fn === "count" && s.column === "*" ? "*" : s.column})`);
  const resultColumns = [...groupByCols, ...specLabels];
  if (specs.length === 0) return { columns: resultColumns, rows: [] };

  interface Bucket {
    key: Record<string, unknown>;
    sums: number[];
    counts: number[];
    mins: number[];
    maxs: number[];
  }
  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const keyValues = groupByCols.map((c) => row[c]);
    const keyStr = groupByCols.length ? JSON.stringify(keyValues) : "__all__";
    let bucket = buckets.get(keyStr);
    if (!bucket) {
      const key: Record<string, unknown> = {};
      groupByCols.forEach((c, i) => (key[c] = keyValues[i]));
      bucket = {
        key,
        sums: specs.map(() => 0),
        counts: specs.map(() => 0),
        mins: specs.map(() => Infinity),
        maxs: specs.map(() => -Infinity),
      };
      buckets.set(keyStr, bucket);
    }
    specs.forEach((spec, i) => {
      if (spec.fn === "count") {
        const hasValue =
          spec.column === "*" ||
          (row[spec.column] !== null && row[spec.column] !== undefined && row[spec.column] !== "");
        if (hasValue) bucket!.counts[i] += 1;
        return;
      }
      const raw = row[spec.column];
      const num = typeof raw === "number" ? raw : Number(raw);
      if (raw === null || raw === undefined || raw === "" || Number.isNaN(num)) return;
      bucket!.sums[i] += num;
      bucket!.counts[i] += 1;
      if (num < bucket!.mins[i]) bucket!.mins[i] = num;
      if (num > bucket!.maxs[i]) bucket!.maxs[i] = num;
    });
  }

  const outRows: Record<string, unknown>[] = [];
  for (const bucket of buckets.values()) {
    const out: Record<string, unknown> = { ...bucket.key };
    specs.forEach((spec, i) => {
      const label = specLabels[i];
      switch (spec.fn) {
        case "sum":
          out[label] = round(bucket.sums[i]);
          break;
        case "avg":
          out[label] = bucket.counts[i] > 0 ? round(bucket.sums[i] / bucket.counts[i]) : null;
          break;
        case "count":
          out[label] = bucket.counts[i];
          break;
        case "min":
          out[label] = bucket.counts[i] > 0 ? bucket.mins[i] : null;
          break;
        case "max":
          out[label] = bucket.counts[i] > 0 ? bucket.maxs[i] : null;
          break;
      }
    });
    outRows.push(out);
  }
  return { columns: resultColumns, rows: outRows };
}

export function AggregationPanel({ columns, columnTypes, getRows, exportFileBaseName }: Props) {
  const idCounter = useRef(0);
  const nextId = () => String(idCounter.current++);
  const defaultColumn = numericColumns(columns, columnTypes)[0] ?? columns[0];

  const [groupByCols, setGroupByCols] = useState<string[]>([]);
  const [specs, setSpecs] = useState<AggSpec[]>([{ id: nextId(), column: defaultColumn, fn: "sum" }]);
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);

  const toggleGroupBy = (col: string) => {
    setGroupByCols((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  };

  const addSpec = () => {
    setSpecs((prev) => [...prev, { id: nextId(), column: defaultColumn, fn: "sum" }]);
  };
  const removeSpec = (id: string) => setSpecs((prev) => prev.filter((s) => s.id !== id));
  const updateSpec = (id: string, patch: Partial<AggSpec>) =>
    setSpecs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const compute = () => {
    setResult(computeAggregation(getRows(), groupByCols, specs));
  };

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border)]">
      <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Aggregate</h3>

      <div className="mb-3 max-w-xs">
        <label className="block text-xs text-[var(--text-muted)] mb-1">Group by (optional)</label>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] truncate">
            {groupByCols.length ? groupByCols.join(", ") : "All rows (no grouping)"}
          </summary>
          <div className="absolute z-10 mt-1 max-h-56 w-64 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg">
            {columns.map((col) => (
              <label key={col} className="flex items-center gap-2 px-1 py-1 text-sm text-[var(--text)]">
                <input type="checkbox" checked={groupByCols.includes(col)} onChange={() => toggleGroupBy(col)} />
                {col}
              </label>
            ))}
          </div>
        </details>
      </div>

      <div className="space-y-2 mb-3">
        {specs.map((spec) => {
          const colChoices = spec.fn === "count" ? columns : numericColumns(columns, columnTypes);
          return (
            <div key={spec.id} className="flex items-center gap-2">
              <select
                value={spec.fn}
                onChange={(e) => {
                  const fn = e.target.value as AggFn;
                  const choices = fn === "count" ? columns : numericColumns(columns, columnTypes);
                  updateSpec(spec.id, {
                    fn,
                    column: choices.includes(spec.column) ? spec.column : choices[0],
                  });
                }}
                className="rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {Object.entries(FN_LABELS).map(([fn, label]) => (
                  <option key={fn} value={fn}>
                    {label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[var(--text-muted)]">of</span>
              <select
                value={spec.column}
                onChange={(e) => updateSpec(spec.id, { column: e.target.value })}
                className="flex-1 max-w-xs rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {spec.fn === "count" && <option value="*">All rows (*)</option>}
                {colChoices.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeSpec(spec.id)}
                className="px-2 text-xs text-[var(--danger)]"
                title="Remove aggregation"
              >
                ✕
              </button>
            </div>
          );
        })}
        <button type="button" onClick={addSpec} className="text-xs font-medium text-[var(--accent)]">
          + Add aggregation
        </button>
      </div>

      <button
        type="button"
        onClick={compute}
        disabled={specs.length === 0}
        className="mb-3 rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50"
      >
        Compute summary
      </button>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        Computed over the currently filtered rows above (and only visible columns can be grouped
        by / aggregated).
      </p>

      {result && (
        <DataGrid
          rows={result.rows}
          columns={result.columns}
          exportFileBaseName={`${exportFileBaseName}-summary`}
          footerNote={`${result.rows.length.toLocaleString()} summary row${
            result.rows.length === 1 ? "" : "s"
          }.`}
          showAggregation={false}
        />
      )}
    </div>
  );
}
