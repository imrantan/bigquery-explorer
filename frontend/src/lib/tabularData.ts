import type { ColumnFilterType } from "../components/DataGrid";

export interface ParsedData {
  columns: string[];
  rows: Record<string, unknown>[];
}

export function inferColumnTypes(
  rows: Record<string, unknown>[],
  columns: string[]
): Record<string, ColumnFilterType> {
  const types: Record<string, ColumnFilterType> = {};
  for (const col of columns) {
    let allNumber = true;
    let allDate = true;
    let sawValue = false;
    for (const row of rows) {
      const v = row[col];
      if (v === null || v === undefined || v === "") continue;
      sawValue = true;
      if (typeof v !== "number") allNumber = false;
      if (!(v instanceof Date)) allDate = false;
      if (!allNumber && !allDate) break;
    }
    types[col] = sawValue && allDate ? "date" : sawValue && allNumber ? "number" : "text";
  }
  return types;
}

export function numericColumns(
  columns: string[],
  columnTypes?: Record<string, ColumnFilterType>
): string[] {
  if (!columnTypes) return columns;
  const nums = columns.filter((c) => columnTypes[c] === "number");
  return nums.length > 0 ? nums : columns;
}

export function hasNumericColumn(
  columns: string[],
  columnTypes?: Record<string, ColumnFilterType>
): boolean {
  if (!columnTypes) return true;
  return columns.some((c) => columnTypes[c] === "number");
}

export function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export type FilterOp = "=" | "!=" | "contains" | ">" | ">=" | "<" | "<=";

export interface SimpleFilter {
  column: string;
  operator: FilterOp;
  value: string;
}

export const FILTER_OPERATORS: { value: FilterOp; label: string }[] = [
  { value: "=", label: "=" },
  { value: "!=", label: "≠" },
  { value: "contains", label: "contains" },
  { value: ">", label: ">" },
  { value: ">=", label: "≥" },
  { value: "<", label: "<" },
  { value: "<=", label: "≤" },
];

export function matchesFilter(
  row: Record<string, unknown>,
  filter: SimpleFilter | null | undefined
): boolean {
  if (!filter || !filter.column) return true;
  const raw = row[filter.column];
  const { operator, value } = filter;

  if (operator === "contains") {
    return String(raw ?? "")
      .toLowerCase()
      .includes(value.toLowerCase());
  }

  const rawNum = typeof raw === "number" ? raw : Number(raw);
  const valNum = Number(value);
  const bothNumeric =
    raw !== null &&
    raw !== undefined &&
    raw !== "" &&
    !Number.isNaN(rawNum) &&
    value.trim() !== "" &&
    !Number.isNaN(valNum);

  if (bothNumeric) {
    switch (operator) {
      case "=":
        return rawNum === valNum;
      case "!=":
        return rawNum !== valNum;
      case ">":
        return rawNum > valNum;
      case ">=":
        return rawNum >= valNum;
      case "<":
        return rawNum < valNum;
      case "<=":
        return rawNum <= valNum;
    }
  }

  const rawStr = raw === null || raw === undefined ? "" : String(raw);
  switch (operator) {
    case "=":
      return rawStr === value;
    case "!=":
      return rawStr !== value;
    case ">":
      return rawStr > value;
    case ">=":
      return rawStr >= value;
    case "<":
      return rawStr < value;
    case "<=":
      return rawStr <= value;
    default:
      return true;
  }
}
