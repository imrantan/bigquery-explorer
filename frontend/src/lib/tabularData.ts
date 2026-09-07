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
