import { useState } from "react";
import { BigQueryTab } from "./components/BigQueryTab";
import { FileDataPanel } from "./components/FileDataPanel";
import { SampleDataTab } from "./components/SampleDataTab";

type Tab = "bigquery" | "file" | "sample";

const TABS: { id: Tab; label: string }[] = [
  { id: "bigquery", label: "BigQuery" },
  { id: "file", label: "CSV / Excel file" },
  { id: "sample", label: "Sample data" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("bigquery");

  return (
    <div className="min-h-screen">
      <div className="ig-gradient h-1 w-full" />
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="ig-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm">
            ▦
          </div>
          <div>
            <h1 className="text-[17px] font-semibold leading-tight text-[var(--text)]">
              BigQuery Explorer
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Browse a table from BigQuery, a local file, or the bundled sample dataset — filter,
              aggregate, decompose, and export.
            </p>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-3 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="ig-gradient absolute inset-x-2 -bottom-px h-0.5 rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {tab === "bigquery" && <BigQueryTab />}
        {tab === "file" && <FileDataPanel />}
        {tab === "sample" && <SampleDataTab />}
      </main>
    </div>
  );
}
