import { useState } from "react";
import { BigQueryTab } from "./components/BigQueryTab";
import { FileDataPanel } from "./components/FileDataPanel";

type Tab = "bigquery" | "file";

const TABS: { id: Tab; label: string }[] = [
  { id: "bigquery", label: "BigQuery" },
  { id: "file", label: "CSV / Excel file" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("bigquery");

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <h1 className="text-lg font-semibold text-[var(--text)]">BigQuery Explorer</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Browse a table from BigQuery or a local file, filter it interactively, and export to
            CSV or Excel.
          </p>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-[var(--accent)] text-[var(--text)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {tab === "bigquery" ? <BigQueryTab /> : <FileDataPanel />}
      </main>
    </div>
  );
}
