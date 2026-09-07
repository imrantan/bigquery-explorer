import { useMemo, useState } from "react";
import type { ColumnFilterType } from "./DataGrid";
import { FilterEditor } from "./FilterEditor";
import type { SimpleFilter } from "../lib/tabularData";
import { matchesFilter, numericColumns, round } from "../lib/tabularData";

type MeasureFn = "sum" | "count";

interface DrillLevel {
  dimension: string;
  value: string;
}

interface Child {
  value: string;
  measure: number;
}

interface Props {
  columns: string[];
  columnTypes?: Record<string, ColumnFilterType>;
  getRows: () => Record<string, unknown>[];
}

const TOP_N = 8;
const BLANK = "(blank)";

function keyOf(row: Record<string, unknown>, dimension: string): string {
  const v = row[dimension];
  return v === null || v === undefined || v === "" ? BLANK : String(v);
}

function computeMeasure(rows: Record<string, unknown>[], column: string, fn: MeasureFn): number {
  if (fn === "count") {
    if (column === "*") return rows.length;
    return rows.filter((r) => r[column] !== null && r[column] !== undefined && r[column] !== "").length;
  }
  let sum = 0;
  for (const row of rows) {
    const raw = row[column];
    const num = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isNaN(num)) sum += num;
  }
  return round(sum);
}

function computeSplit(
  rows: Record<string, unknown>[],
  dimension: string,
  column: string,
  fn: MeasureFn
): Child[] {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = keyOf(row, dimension);
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return Array.from(map.entries())
    .map(([value, bucketRows]) => ({ value, measure: computeMeasure(bucketRows, column, fn) }))
    .sort((a, b) => Math.abs(b.measure) - Math.abs(a.measure));
}

function rowsAtLevel(
  baseRows: Record<string, unknown>[],
  path: DrillLevel[],
  levelIndex: number
): Record<string, unknown>[] {
  let rows = baseRows;
  for (let i = 0; i < levelIndex; i++) {
    const { dimension, value } = path[i];
    rows = rows.filter((r) => keyOf(r, dimension) === value);
  }
  return rows;
}

export function DecompositionTree({ columns, columnTypes, getRows }: Props) {
  const numCols = numericColumns(columns, columnTypes);
  const [measureColumn, setMeasureColumn] = useState(numCols[0] ?? columns[0] ?? "");
  const [measureFn, setMeasureFn] = useState<MeasureFn>(numCols.length > 0 ? "sum" : "count");
  const [sharedFilter, setSharedFilter] = useState<SimpleFilter | null>(null);
  const [baseRows, setBaseRows] = useState<Record<string, unknown>[] | null>(null);
  const [path, setPath] = useState<DrillLevel[]>([]);
  const [pendingDimension, setPendingDimension] = useState<string>("");

  const buildTree = () => {
    const rows = getRows().filter((r) => matchesFilter(r, sharedFilter));
    setBaseRows(rows);
    setPath([]);
    setPendingDimension("");
  };

  const total = useMemo(
    () => (baseRows ? computeMeasure(baseRows, measureColumn, measureFn) : 0),
    [baseRows, measureColumn, measureFn]
  );

  const selectSibling = (levelIndex: number, dimension: string, value: string) => {
    setPath((prev) => [...prev.slice(0, levelIndex), { dimension, value }]);
    setPendingDimension("");
  };

  const changeLevelDimension = (levelIndex: number, dimension: string) => {
    setPath((prev) => prev.slice(0, levelIndex));
    setPendingDimension(dimension);
  };

  const resetTree = () => {
    setPath([]);
    setPendingDimension("");
  };

  if (!baseRows) {
    return (
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Decompose</h3>
        <DecomposeControls
          columns={columns}
          numCols={numCols}
          measureColumn={measureColumn}
          setMeasureColumn={setMeasureColumn}
          measureFn={measureFn}
          setMeasureFn={setMeasureFn}
          sharedFilter={sharedFilter}
          setSharedFilter={setSharedFilter}
          onBuild={buildTree}
        />
        <p className="text-xs text-[var(--text-muted)]">
          Pick a measure (and optional filter), then click "Build tree" to start.
        </p>
      </div>
    );
  }

  if (baseRows.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Decompose</h3>
        <DecomposeControls
          columns={columns}
          numCols={numCols}
          measureColumn={measureColumn}
          setMeasureColumn={setMeasureColumn}
          measureFn={measureFn}
          setMeasureFn={setMeasureFn}
          sharedFilter={sharedFilter}
          setSharedFilter={setSharedFilter}
          onBuild={buildTree}
        />
        <p className="text-xs text-[var(--danger)]">No rows match the current filter.</p>
      </div>
    );
  }

  const levels: { rows: Record<string, unknown>[]; dimension: string; selected: string; excluded: Set<string> }[] =
    [];
  for (let i = 0; i < path.length; i++) {
    levels.push({
      rows: rowsAtLevel(baseRows, path, i),
      dimension: path[i].dimension,
      selected: path[i].value,
      excluded: new Set(path.slice(0, i).map((p) => p.dimension)),
    });
  }
  const frontierRows = rowsAtLevel(baseRows, path, path.length);
  const frontierExcluded = new Set(path.map((p) => p.dimension));

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border)]">
      <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Decompose</h3>
      <DecomposeControls
        columns={columns}
        numCols={numCols}
        measureColumn={measureColumn}
        setMeasureColumn={setMeasureColumn}
        measureFn={measureFn}
        setMeasureFn={setMeasureFn}
        sharedFilter={sharedFilter}
        setSharedFilter={setSharedFilter}
        onBuild={buildTree}
      />

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-[var(--text-muted)]">
          Click a value to drill in; pick a different dimension at any level to branch elsewhere.
          "Build tree" re-pulls rows using the grid's filters above.
        </p>
        {path.length > 0 && (
          <button type="button" onClick={resetTree} className="text-xs font-medium text-[var(--accent)] shrink-0 ml-2">
            Reset
          </button>
        )}
      </div>

      <div className="flex items-start gap-4 overflow-x-auto pb-2">
        <TreeLevel
          title="Total"
          parentValue={null}
          children={[{ value: "Total", measure: total }]}
          selectedValue="Total"
          onSelect={() => {}}
          clickable={false}
        />

        {levels.map((level, i) => {
          const parentValue = i === 0 ? total : computeMeasure(rowsAtLevel(baseRows, path, i), measureColumn, measureFn);
          const children = computeSplit(level.rows, level.dimension, measureColumn, measureFn);
          const available = columns.filter((c) => c !== measureColumn && !level.excluded.has(c));
          return (
            <TreeLevel
              key={i}
              title={level.dimension}
              dimensionPicker={
                <select
                  value={level.dimension}
                  onChange={(e) => changeLevelDimension(i, e.target.value)}
                  className="mb-1 w-full rounded-md border border-[var(--border)] bg-transparent px-1.5 py-1 text-xs text-[var(--text)]"
                >
                  {available.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              }
              parentValue={parentValue}
              children={children}
              selectedValue={level.selected}
              onSelect={(value) => selectSibling(i, level.dimension, value)}
              clickable
            />
          );
        })}

        <PendingLevel
          columns={columns.filter((c) => c !== measureColumn && !frontierExcluded.has(c))}
          dimension={pendingDimension}
          onDimensionChange={setPendingDimension}
          rows={frontierRows}
          measureColumn={measureColumn}
          measureFn={measureFn}
          parentValue={
            path.length === 0 ? total : computeMeasure(rowsAtLevel(baseRows, path, path.length), measureColumn, measureFn)
          }
          onSelect={(dimension, value) => selectSibling(path.length, dimension, value)}
        />
      </div>
    </div>
  );
}

function DecomposeControls({
  columns,
  numCols,
  measureColumn,
  setMeasureColumn,
  measureFn,
  setMeasureFn,
  sharedFilter,
  setSharedFilter,
  onBuild,
}: {
  columns: string[];
  numCols: string[];
  measureColumn: string;
  setMeasureColumn: (c: string) => void;
  measureFn: MeasureFn;
  setMeasureFn: (f: MeasureFn) => void;
  sharedFilter: SimpleFilter | null;
  setSharedFilter: (f: SimpleFilter | null) => void;
  onBuild: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-3">
      <div>
        <label className="block text-xs text-[var(--text-muted)] mb-1">Measure</label>
        <select
          value={measureFn}
          onChange={(e) => {
            const fn = e.target.value as MeasureFn;
            setMeasureFn(fn);
            if (fn === "count" && measureColumn === "") setMeasureColumn("*");
          }}
          className="rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="sum" disabled={numCols.length === 0}>
            Sum
          </option>
          <option value="count">Count</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-[var(--text-muted)] mb-1">of</label>
        <select
          value={measureColumn}
          onChange={(e) => setMeasureColumn(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          {measureFn === "count" && <option value="*">All rows (*)</option>}
          {(measureFn === "count" ? columns : numCols).map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-[var(--text-muted)] mb-1">Filter (optional)</label>
        <FilterEditor columns={columns} value={sharedFilter} onChange={setSharedFilter} />
      </div>
      <button
        type="button"
        onClick={onBuild}
        className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-fg)]"
      >
        Build tree
      </button>
    </div>
  );
}

function TreeLevel({
  title,
  dimensionPicker,
  parentValue,
  children,
  selectedValue,
  onSelect,
  clickable,
}: {
  title: string;
  dimensionPicker?: React.ReactNode;
  parentValue: number | null;
  children: Child[];
  selectedValue: string;
  onSelect: (value: string) => void;
  clickable: boolean;
}) {
  const shown = children.slice(0, TOP_N);
  const rest = children.slice(TOP_N);
  const otherSum = rest.reduce((s, c) => s + c.measure, 0);
  const maxAbs = Math.max(...shown.map((c) => Math.abs(c.measure)), Math.abs(otherSum), 1);

  return (
    <div className="w-44 shrink-0">
      {dimensionPicker ?? <div className="mb-1 text-xs font-medium text-[var(--text)] truncate">{title}</div>}
      <div className="space-y-1">
        {shown.map((child) => (
          <Card
            key={child.value}
            label={child.value}
            measure={child.measure}
            parentValue={parentValue}
            maxAbs={maxAbs}
            selected={child.value === selectedValue}
            clickable={clickable}
            onClick={() => onSelect(child.value)}
          />
        ))}
        {rest.length > 0 && (
          <Card
            label={`Other (${rest.length})`}
            measure={otherSum}
            parentValue={parentValue}
            maxAbs={maxAbs}
            selected={false}
            clickable={false}
            dashed
            onClick={() => {}}
          />
        )}
      </div>
    </div>
  );
}

function PendingLevel({
  columns,
  dimension,
  onDimensionChange,
  rows,
  measureColumn,
  measureFn,
  parentValue,
  onSelect,
}: {
  columns: string[];
  dimension: string;
  onDimensionChange: (d: string) => void;
  rows: Record<string, unknown>[];
  measureColumn: string;
  measureFn: MeasureFn;
  parentValue: number;
  onSelect: (dimension: string, value: string) => void;
}) {
  if (columns.length === 0) {
    return (
      <div className="w-44 shrink-0 text-xs text-[var(--text-muted)]">All dimensions used.</div>
    );
  }

  const children = dimension ? computeSplit(rows, dimension, measureColumn, measureFn) : [];

  return (
    <div className="w-44 shrink-0">
      <select
        value={dimension}
        onChange={(e) => onDimensionChange(e.target.value)}
        className="mb-1 w-full rounded-md border border-[var(--border)] bg-transparent px-1.5 py-1 text-xs text-[var(--text)]"
      >
        <option value="">Split by…</option>
        {columns.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {dimension && (
        <TreeLevel
          title={dimension}
          parentValue={parentValue}
          children={children}
          selectedValue=""
          onSelect={(value) => onSelect(dimension, value)}
          clickable
        />
      )}
    </div>
  );
}

function Card({
  label,
  measure,
  parentValue,
  maxAbs,
  selected,
  clickable,
  dashed,
  onClick,
}: {
  label: string;
  measure: number;
  parentValue: number | null;
  maxAbs: number;
  selected: boolean;
  clickable: boolean;
  dashed?: boolean;
  onClick: () => void;
}) {
  const pct = parentValue && parentValue !== 0 ? (measure / parentValue) * 100 : null;
  const barPct = maxAbs > 0 ? (Math.abs(measure) / maxAbs) * 100 : 0;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-md border px-2 py-1.5 text-left text-xs ${
        selected
          ? "border-[var(--accent)] bg-[var(--accent)]/10"
          : dashed
            ? "border-dashed border-[var(--border)]"
            : "border-[var(--border)]"
      } ${clickable ? "cursor-pointer hover:border-[var(--accent)]" : "cursor-default"}`}
    >
      <div
        className="absolute inset-y-0 left-0 bg-[var(--accent)]/10"
        style={{ width: `${barPct}%` }}
      />
      <div className="relative truncate font-medium text-[var(--text)]" title={label}>
        {label}
      </div>
      <div className="relative flex items-baseline justify-between text-[var(--text-muted)]">
        <span>{measure.toLocaleString()}</span>
        {pct !== null && <span>{pct.toFixed(1)}%</span>}
      </div>
    </button>
  );
}
