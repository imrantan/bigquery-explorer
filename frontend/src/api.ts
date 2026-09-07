import type {
  AppConfig,
  SavedTable,
  StatusResponse,
  TableDataResponse,
  TableInfo,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.detail ?? res.statusText;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return res.json() as Promise<T>;
}

export const api = {
  getStatus: () => request<StatusResponse>("/api/status"),

  setServiceAccount: (path: string) =>
    request<StatusResponse>("/api/service-account", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),

  getConfig: () => request<AppConfig>("/api/config"),

  listSavedTables: () => request<SavedTable[]>("/api/saved-tables"),

  addSavedTable: (table: SavedTable) =>
    request<SavedTable[]>("/api/saved-tables", {
      method: "POST",
      body: JSON.stringify(table),
    }),

  removeSavedTable: (tableId: string) =>
    request<SavedTable[]>(`/api/saved-tables/${encodeURIComponent(tableId)}`, {
      method: "DELETE",
    }),

  getTableInfo: (tableId: string) =>
    request<TableInfo>("/api/table-info", {
      method: "POST",
      body: JSON.stringify({ table_id: tableId }),
    }),

  getTableData: (params: {
    table_id: string;
    row_limit: number;
    where_clause?: string;
    order_by?: string;
    order_dir?: "ASC" | "DESC";
  }) =>
    request<TableDataResponse>("/api/table-data", {
      method: "POST",
      body: JSON.stringify(params),
    }),
};
