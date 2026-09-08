import { FILTER_OPERATORS } from "../lib/tabularData";
import type { FilterOp, SimpleFilter } from "../lib/tabularData";

interface Props {
  columns: string[];
  value: SimpleFilter | null;
  onChange: (filter: SimpleFilter | null) => void;
}

const selectClass =
  "rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const inputClass =
  "w-32 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

export function FilterEditor({ columns, value, onChange }: Props) {
  const column = value?.column ?? "";
  const operator = value?.operator ?? "=";
  const filterValue = value?.value ?? "";

  const update = (patch: Partial<SimpleFilter>) => {
    const next: SimpleFilter = { column, operator, value: filterValue, ...patch };
    onChange(next.column ? next : null);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={column} onChange={(e) => update({ column: e.target.value })} className={selectClass}>
        <option value="">No filter</option>
        {columns.map((col) => (
          <option key={col} value={col}>
            {col}
          </option>
        ))}
      </select>
      {column && (
        <>
          <select
            value={operator}
            onChange={(e) => update({ operator: e.target.value as FilterOp })}
            className={selectClass}
          >
            {FILTER_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={filterValue}
            onChange={(e) => update({ value: e.target.value })}
            placeholder="value"
            className={inputClass}
          />
        </>
      )}
    </div>
  );
}
