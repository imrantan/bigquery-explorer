import Papa from "papaparse";
import { useEffect, useState } from "react";
import { DataGrid } from "./DataGrid";
import type { ParsedData } from "../lib/tabularData";
import { inferColumnTypes } from "../lib/tabularData";

const SAMPLE_DATA_URL = "/sample-data/dummy_sales.csv";

export function SampleDataTab() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(SAMPLE_DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the sample dataset (HTTP ${res.status}).`);
        return res.text();
      })
      .then((csvText) => {
        if (cancelled) return;
        const results = Papa.parse<Record<string, unknown>>(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });
        setData({ columns: results.meta.fields ?? [], rows: results.data });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const columnTypes = data ? inferColumnTypes(data.rows, data.columns) : undefined;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--text)] mb-1">Sample sales dataset</h2>
        <p className="text-xs text-[var(--text-muted)]">
          A synthetic dataset bundled with the app so you can try filtering, column visibility,
          aggregation, and decomposition without connecting BigQuery or uploading a file. Long/P&amp;L
          shape: date, location, category, channel, product_name, account, amount — each
          transaction is two rows, one with account="Volume" (units) and one with
          account="Sales" ($). Try an Aggregate ratio metric for "Sales per unit":
          Sum(amount) where account=Sales ÷ Sum(amount) where account=Volume.
        </p>
      </div>

      {loading && <p className="text-sm text-[var(--text-muted)]">Loading sample dataset…</p>}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {data && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <DataGrid
            rows={data.rows}
            columns={data.columns}
            columnTypes={columnTypes}
            exportFileBaseName="dummy_sales"
            footerNote={`Loaded ${data.rows.length.toLocaleString()} rows from the bundled sample dataset.`}
          />
        </div>
      )}
    </div>
  );
}
