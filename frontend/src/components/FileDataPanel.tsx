import ExcelJS from "exceljs";
import Papa from "papaparse";
import { useRef, useState } from "react";
import { DataGrid } from "./DataGrid";
import type { ParsedData } from "../lib/tabularData";
import { inferColumnTypes } from "../lib/tabularData";

function cellToValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return (v as ExcelJS.CellHyperlinkValue).text;
    if ("result" in v) return (v as ExcelJS.CellFormulaValue).result ?? null;
    if ("error" in v) return `#ERROR: ${(v as ExcelJS.CellErrorValue).error}`;
    return JSON.stringify(v);
  }
  return v;
}

function parseWorksheet(ws: ExcelJS.Worksheet): ParsedData {
  const colCount = ws.actualColumnCount;
  const headerRow = ws.getRow(1);
  const columns: string[] = [];
  for (let c = 1; c <= colCount; c++) {
    const label = cellToValue(headerRow.getCell(c));
    const text = label === null || label === undefined ? "" : String(label).trim();
    columns.push(text || `Column ${c}`);
  }

  const rows: Record<string, unknown>[] = [];
  for (let r = 2; r <= ws.actualRowCount + 1; r++) {
    const row = ws.getRow(r);
    if (row.cellCount === 0) continue;
    const obj: Record<string, unknown> = {};
    for (let c = 1; c <= colCount; c++) {
      obj[columns[c - 1]] = cellToValue(row.getCell(c));
    }
    rows.push(obj);
  }
  return { columns, rows };
}

export function FileDataPanel() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileKind, setFileKind] = useState<"csv" | "excel" | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const workbookRef = useRef<ExcelJS.Workbook | null>(null);

  const loadCsv = (file: File) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsed({ columns: results.meta.fields ?? [], rows: results.data });
        setLoading(false);
      },
      error: (err: Error) => {
        setError(err.message);
        setLoading(false);
      },
    });
  };

  const loadExcel = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    workbookRef.current = workbook;

    const names = workbook.worksheets.map((ws) => ws.name);
    if (names.length === 0) throw new Error("No sheets found in this workbook.");

    setSheetNames(names);
    setSelectedSheet(names[0]);
    setParsed(parseWorksheet(workbook.getWorksheet(names[0])!));
    setLoading(false);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setFileKind(null);
    setSheetNames([]);
    setSelectedSheet("");
    setParsed(null);
    setError(null);
    workbookRef.current = null;
    setLoading(true);

    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      if (ext === "csv") {
        setFileKind("csv");
        loadCsv(file);
      } else if (ext === "xlsx") {
        setFileKind("excel");
        await loadExcel(file);
      } else if (ext === "xls") {
        throw new Error(
          "Legacy .xls files aren't supported — save the file as .xlsx (or .csv) and try again."
        );
      } else {
        throw new Error("Unsupported file type. Please choose a .csv or .xlsx file.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  const handleSheetChange = (name: string) => {
    const ws = workbookRef.current?.getWorksheet(name);
    if (!ws) return;
    setSelectedSheet(name);
    setParsed(parseWorksheet(ws));
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const columnTypes = parsed ? inferColumnTypes(parsed.rows, parsed.columns) : undefined;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors bg-[var(--surface)] ${
          dragOver ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)]"
        }`}
      >
        <p className="text-sm text-[var(--text)] mb-2">
          Drag &amp; drop a .csv or .xlsx file here
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-3">or</p>
        <label className="inline-block cursor-pointer rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-fg)]">
          Choose file
          <input
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={onInputChange}
          />
        </label>
        {fileName && (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {loading ? "Parsing " : "Loaded "}
            {fileName}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {fileKind === "excel" && sheetNames.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--text-muted)]">Sheet</label>
          <select
            value={selectedSheet}
            onChange={(e) => handleSheetChange(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {sheetNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      {parsed && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <DataGrid
            rows={parsed.rows}
            columns={parsed.columns}
            columnTypes={columnTypes}
            exportFileBaseName={(fileName ?? "data").replace(/\.[^./]+$/, "")}
            footerNote={`Loaded ${parsed.rows.length.toLocaleString()} rows from ${fileName}${
              fileKind === "excel" ? ` (sheet "${selectedSheet}")` : ""
            }.`}
          />
        </div>
      )}
    </div>
  );
}
