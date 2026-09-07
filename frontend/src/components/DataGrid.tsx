import { AllCommunityModule, ModuleRegistry, themeQuartz, colorSchemeDark } from "ag-grid-community";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import ExcelJS from "exceljs";
import { useMemo, useRef } from "react";

ModuleRegistry.registerModules([AllCommunityModule]);

const prefersDark =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const gridTheme = (prefersDark ? themeQuartz.withPart(colorSchemeDark) : themeQuartz).withParams(
  { accentColor: "#2563eb" }
);

export type ColumnFilterType = "text" | "number" | "date";

function filterTypeToAgFilter(type: ColumnFilterType): string {
  if (type === "number") return "agNumberColumnFilter";
  if (type === "date") return "agDateColumnFilter";
  return "agTextColumnFilter";
}

function dateFilterComparator(filterLocalDateAtMidnight: Date, cellValue: unknown): number {
  if (cellValue === null || cellValue === undefined) return -1;
  const d = cellValue instanceof Date ? cellValue : new Date(String(cellValue));
  if (Number.isNaN(d.getTime())) return -1;
  const cellDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (cellDate < filterLocalDateAtMidnight) return -1;
  if (cellDate > filterLocalDateAtMidnight) return 1;
  return 0;
}

function buildColumnDefs(
  columns: string[],
  columnTypes?: Record<string, ColumnFilterType>
): ColDef[] {
  return columns.map((name) => {
    const type = columnTypes?.[name] ?? "text";
    return {
      field: name,
      headerName: name,
      filter: filterTypeToAgFilter(type),
      filterParams: type === "date" ? { comparator: dateFilterComparator } : undefined,
      sortable: true,
      resizable: true,
      valueGetter: (params) => {
        const val = params.data?.[name];
        if (val instanceof Date) return val;
        if (val !== null && typeof val === "object") return JSON.stringify(val);
        return val;
      },
      valueFormatter:
        type === "date"
          ? (params) => (params.value instanceof Date ? params.value.toLocaleDateString() : params.value ?? "")
          : undefined,
      minWidth: 130,
    };
  });
}

interface Props {
  rows: Record<string, unknown>[];
  columns: string[];
  columnTypes?: Record<string, ColumnFilterType>;
  exportFileBaseName: string;
  footerNote?: string;
}

export function DataGrid({ rows, columns, columnTypes, exportFileBaseName, footerNote }: Props) {
  const gridApiRef = useRef<GridApi | null>(null);

  const columnDefs = useMemo(() => buildColumnDefs(columns, columnTypes), [columns, columnTypes]);

  const onGridReady = (e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  };

  const exportCsv = () => {
    gridApiRef.current?.exportDataAsCsv({
      fileName: `${exportFileBaseName}.csv`,
    });
  };

  const exportExcel = async () => {
    const gridApi = gridApiRef.current;
    if (!gridApi) return;

    const visibleCols = gridApi.getAllDisplayedColumns();
    const headers = visibleCols.map((c) => c.getColDef().headerName ?? c.getColId());

    const exportRows: unknown[][] = [];
    gridApi.forEachNodeAfterFilterAndSort((node) => {
      exportRows.push(
        visibleCols.map((c) => gridApi.getCellValue({ rowNode: node, colKey: c }))
      );
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("data");
    sheet.addRow(headers);
    exportRows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFileBaseName}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-xs text-[var(--text-muted)]">
          {footerNote ?? `Loaded ${rows.length.toLocaleString()} rows.`} Use each column header's
          filter icon to filter; exports respect the current filter and sort.
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
          rowData={rows}
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
  );
}
