import { useEffect, useState } from "react";
import { api } from "../api";
import { BigQueryDataPanel } from "./BigQueryDataPanel";
import { ServiceAccountPanel } from "./ServiceAccountPanel";
import { TableInfoPanel } from "./TableInfoPanel";
import { TableSelector } from "./TableSelector";
import type { AppConfig, SavedTable, StatusResponse, TableInfo } from "../types";

export function BigQueryTab() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [savedTables, setSavedTables] = useState<SavedTable[]>([]);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  useEffect(() => {
    api.getStatus().then(setStatus).catch(() => {});
    api.getConfig().then(setConfig).catch(() => {});
    api.listSavedTables().then(setSavedTables).catch(() => {});
  }, []);

  const handleSelectTable = async (tableId: string) => {
    setActiveTableId(tableId);
    setTableInfo(null);
    setInfoError(null);
    setInfoLoading(true);
    try {
      const info = await api.getTableInfo(tableId);
      setTableInfo(info);
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : String(err));
    } finally {
      setInfoLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ServiceAccountPanel status={status} onStatusChange={setStatus} />
        <TableSelector
          savedTables={savedTables}
          onSavedTablesChange={setSavedTables}
          activeTableId={activeTableId}
          onSelect={handleSelectTable}
          disabled={!status?.configured}
        />
      </div>

      {!status?.configured && (
        <p className="text-sm text-[var(--text-muted)]">
          Connect a service account above to get started.
        </p>
      )}

      {infoLoading && <p className="text-sm text-[var(--text-muted)]">Loading table info…</p>}
      {infoError && <p className="text-sm text-[var(--danger)]">{infoError}</p>}

      {tableInfo && <TableInfoPanel info={tableInfo} />}

      {tableInfo && config && (
        <BigQueryDataPanel
          tableId={tableInfo.table_id}
          schema={tableInfo.schema}
          defaultRowLimit={config.default_row_limit}
          maxRowLimit={config.max_row_limit}
        />
      )}
    </div>
  );
}
