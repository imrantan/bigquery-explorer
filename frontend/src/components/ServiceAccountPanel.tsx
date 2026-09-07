import { useState } from "react";
import { api } from "../api";
import type { StatusResponse } from "../types";

interface Props {
  status: StatusResponse | null;
  onStatusChange: (status: StatusResponse) => void;
}

export function ServiceAccountPanel({ status, onStatusChange }: Props) {
  const [path, setPath] = useState(status?.service_account_path ?? "");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) return;
    setSaving(true);
    setLocalError(null);
    try {
      const next = await api.setServiceAccount(path.trim());
      onStatusChange(next);
      if (next.error) setLocalError(next.error);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const configured = status?.configured ?? false;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--text)]">Service account</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            configured
              ? "bg-green-500/15 text-[var(--success)]"
              : "bg-red-500/15 text-[var(--danger)]"
          }`}
        >
          {configured ? "Connected" : "Not connected"}
        </span>
      </div>

      {configured && status && (
        <div className="text-xs text-[var(--text-muted)] mb-3 space-y-0.5">
          <div>
            Account: <span className="text-[var(--text)]">{status.service_account_email}</span>
          </div>
          <div>
            Project: <span className="text-[var(--text)]">{status.project_id}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="C:\path\to\service-account.json"
          className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={saving || !path.trim()}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50"
        >
          {saving ? "Checking…" : "Connect"}
        </button>
      </form>

      {(localError || status?.error) && (
        <p className="mt-2 text-xs text-[var(--danger)]">{localError ?? status?.error}</p>
      )}
    </div>
  );
}
