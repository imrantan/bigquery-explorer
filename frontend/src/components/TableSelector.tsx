import { useState } from "react";
import { api } from "../api";
import type { SavedTable } from "../types";

interface Props {
  savedTables: SavedTable[];
  onSavedTablesChange: (tables: SavedTable[]) => void;
  activeTableId: string | null;
  onSelect: (tableId: string) => void;
  disabled: boolean;
}

export function TableSelector({
  savedTables,
  onSavedTablesChange,
  activeTableId,
  onSelect,
  disabled,
}: Props) {
  const [customTable, setCustomTable] = useState("");
  const [saveLabel, setSaveLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleUseCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTable.trim()) return;
    onSelect(customTable.trim());
  };

  const handleSave = async () => {
    if (!customTable.trim()) return;
    setError(null);
    try {
      const next = await api.addSavedTable({
        label: saveLabel.trim() || customTable.trim(),
        table_id: customTable.trim(),
      });
      onSavedTablesChange(next);
      setSaveLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRemove = async (tableId: string) => {
    const next = await api.removeSavedTable(tableId);
    onSavedTablesChange(next);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Table</h2>

      {savedTables.length > 0 && (
        <div className="mb-4 space-y-1">
          {savedTables.map((t) => (
            <div
              key={t.table_id}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer ${
                activeTableId === t.table_id
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "hover:bg-[var(--surface-alt)] text-[var(--text)]"
              }`}
              onClick={() => !disabled && onSelect(t.table_id)}
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{t.label}</div>
                <div
                  className={`truncate text-xs ${
                    activeTableId === t.table_id ? "opacity-80" : "text-[var(--text-muted)]"
                  }`}
                >
                  {t.table_id}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(t.table_id);
                }}
                className="ml-2 shrink-0 text-xs opacity-60 hover:opacity-100"
                title="Remove from saved tables"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleUseCustom} className="space-y-2">
        <label className="block text-xs text-[var(--text-muted)]">
          Enter a table (project.dataset.table)
        </label>
        <input
          type="text"
          value={customTable}
          onChange={(e) => setCustomTable(e.target.value)}
          placeholder="my-project.my_dataset.my_table"
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={disabled || !customTable.trim()}
            className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50"
          >
            Use table
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={saveLabel}
            onChange={(e) => setSaveLabel(e.target.value)}
            placeholder="Optional label to save it"
            className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!customTable.trim()}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>

      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
