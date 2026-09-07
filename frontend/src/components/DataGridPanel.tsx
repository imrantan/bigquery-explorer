import { AllCommunityModule, ModuleRegistry, themeQuartz, colorSchemeDark } from "ag-grid-community";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import ExcelJS from "exceljs";
import { useMemo, useRef, useState } from "react";
import { api } from "../api";
import type { ColumnSchema, TableDataResponse } from "../types";

ModuleRegistry.registerModules([AllCommunityModule]);

const prefersDark =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const gridTheme = (prefersDark ? themeQuartz.withPart(colorSchemeDark) : themeQuartz).withParams(
  { accentColor: "#2563eb" }
);

interface Props {
  tableId: string;
  schema: ColumnSchema[];
  defaultRowLimit: number;
  maxRowLimit: number;
}

function bqTypeToFilter(type: string): string {
  if (["INTEGER", "INT64", "FLOAT", "FLOAT64", "NUMERIC", "BIGNUMERIC"].includes(type)) {
    return "agNumberColumnFilter";
  }
  if (["DATE", "DATETIME", "TIMESTAMP", "TIME"].includes(type)) {
    return "agDateColumnFilter";
  }
  return "agTextColumnFilter";
}

function buildColumnDefs(columns: string[], schema: ColumnSchema[]): ColDef[] {
  const typeByName = new Map(schema.map((c) => [c.name, c.type]));
  return columns.map((name) => ({
    field: name,
    headerName: name,
    filter: bqTypeToFilter(typeByName.get(name) ?? "STRING"),
    sortable: true,
    resizable: true,
    valueGetter: (params) => {
      const val = params.data?.[name];
      if (val !== null && typeof val === "object") return JSON.stringify(val);
      return val;
    },
    minWidth: 130,
  }));
}

export function DataGridPanel({ tableId, schema, defaultRowLimit, maxRowLimit }: Props) {
  const [rowLimit, setRowLimit] = useState(defaultRowLimit);
  const [whereClause, setWhereClause] = useState("");
  const [orderBy, setOrderBy] = useState("");
  const [orderDir, setOrderDir] = useState<"ASC" | "DESC">("ASC");
  const [data, setData] = useState<TableDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gridApiRef = useRef<GridApi | null>(null);

  const columnDefs = useMemo(
    () => (data ? buildColumnDefs(data.columns, schema) : []),
    [data, schema]
  );

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

  const onGridReady = (e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  };

  const exportCsv = () => {
    gridApiRef.current?.exportDataAsCsv({
      fileName: `${tableId.split(".").pop()}.csv`,
    });
  };

  const exportExcel = async () => {
    const gridApi = gridApiRef.current;
    if (!gridApi || !data) return;

    const visibleCols = gridApi.getAllDisplayedColumns();
    const headers = visibleCols.map((c) => c.getColDef().headerName ?? c.getColId());

    const rows: unknown[][] = [];
    gridApi.forEachNodeAfterFilterAndSort((node) => {
      rows.push(
        visibleCols.map((c) => gridApi.getCellValue({ rowNode: node, colKey: c }))
      );
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("data");
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tableId.split(".").pop()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
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
            className="w-28 rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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
            className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Order by</label>
          <input
            type="text"
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
            placeholder="column"
            className="w-36 rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Direction</label>
          <select
            value={orderDir}
            onChange={(e) => setOrderDir(e.target.value as "ASC" | "DESC")}
            className="rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="ASC">ASC</option>
            <option value="DESC">DESC</option>
          </select>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load data"}
        </button>
      </div>

      {error && <p className="mb-3 text-xs text-[var(--danger)]">{error}</p>}

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-xs text-[var(--text-muted)]">
              Loaded {data.row_count.toLocaleString()} rows
              {data.truncated ? ` (capped at ${rowLimit.toLocaleString()} — raise the row limit to see more)` : ""}.
              Use each column header's filter icon to filter; exports respect the current filter and sort.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportCsv}
                className="rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--text)]"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={exportExcel}
                className="rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--text)]"
              >
                Export Excel
              </button>
            </div>
          </div>

          <div style={{ height: 560, width: "100%" }}>
            <AgGridReact
              theme={gridTheme}
              rowData={data.rows}
              columnDefs={columnDefs}
              defaultColDef={{ floatingFilter: true }}
              onGridReady={onGridReady}
              animateRows
              pagination
              paginationPageSize={100}
              paginationPageSizeSelector={[50, 100, 250, 500]}
            />
          </div>
        </>
      )}
    </div>
  );
}
