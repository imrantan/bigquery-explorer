export interface StatusResponse {
  configured: boolean;
  service_account_path: string | null;
  service_account_email: string | null;
  project_id: string | null;
  error: string | null;
}

export interface SavedTable {
  label: string;
  table_id: string;
}

export interface ColumnSchema {
  name: string;
  type: string;
  mode: string;
  description: string | null;
}

export interface TableInfo {
  table_id: string;
  schema: ColumnSchema[];
  num_rows: number | null;
  num_bytes: number | null;
  size_human: string | null;
  description: string | null;
  created: string | null;
  last_modified: string | null;
}

export interface TableDataResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
  bytes_billed: number | null;
}

export interface AppConfig {
  max_row_limit: number;
  default_row_limit: number;
}
