import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ColumnFilterType } from "./DataGrid";
import { FilterEditor } from "./FilterEditor";
import type { SimpleFilter } from "../lib/tabularData";
import { matchesFilter, numericColumns, round } from "../lib/tabularData";

type MeasureFn = "sum" | "count";
type Row = Record<string, unknown>;

interface TreeNode {
  value: string;
  measure: number;
}

interface Props {
  columns: string[];
  columnTypes?: Record<string, ColumnFilterType>;
  getRows: () => Row[];
  gridReady: boolean;
}

const BLANK = "(blank)";
const ROOT_KEY = "root";

function keyOf(row: Row, dimension: string): string {
  const v = row[dimension];
  return v === null || v === undefined || v === "" ? BLANK : String(v);
}

function computeMeasure(rows: Row[], column: string, fn: MeasureFn): number {
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

/** Distinct values of `dimension`, measured and sorted highest value first (Power BI order). */
function computeNodes(rows: Row[], dimension: string, column: string, fn: MeasureFn): TreeNode[] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = keyOf(row, dimension);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return Array.from(groups.entries())
    .map(([value, bucketRows]) => ({ value, measure: computeMeasure(bucketRows, column, fn) }))
    .sort((a, b) => b.measure - a.measure);
}

/**
 * Keeps every level's selection valid: preserves the existing pick where it still
 * exists (Power BI keeps deeper levels when you switch siblings), otherwise falls
 * back to that level's top contributor.
 */
function repairSelection(
  rows: Row[],
  levels: string[],
  selected: string[],
  column: string,
  fn: MeasureFn
): string[] {
  const out: string[] = [];
  let cur = rows;
  for (let i = 0; i < levels.length; i++) {
    const nodes = computeNodes(cur, levels[i], column, fn);
    const wanted = selected[i];
    const pick = nodes.some((n) => n.value === wanted) ? wanted : (nodes[0]?.value ?? "");
    out.push(pick);
    cur = cur.filter((r) => keyOf(r, levels[i]) === pick);
  }
  return out;
}

function aiSplit(
  rows: Row[],
  candidates: string[],
  column: string,
  fn: MeasureFn,
  mode: "high" | "low"
): { field: string; value: string } | null {
  let best: { field: string; value: string; score: number } | null = null;
  for (const field of candidates) {
    const nodes = computeNodes(rows, field, column, fn);
    if (nodes.length < 2) continue;
    const candidate = mode === "high" ? nodes[0] : nodes[nodes.length - 1];
    const score = mode === "high" ? candidate.measure : -candidate.measure;
    if (!best || score > best.score) best = { field, value: candidate.value, score };
  }
  return best ? { field: best.field, value: best.value } : null;
}

function abbreviate(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function DecompositionTree({ columns, columnTypes, getRows, gridReady }: Props) {
  const numCols = useMemo(() => numericColumns(columns, columnTypes), [columns, columnTypes]);

  const [measureFn, setMeasureFn] = useState<MeasureFn>(numCols.length > 0 ? "sum" : "count");
  const [measureColumn, setMeasureColumn] = useState(numCols[0] ?? "*");
  const [filter, setFilter] = useState<SimpleFilter | null>(null);
  const [baseRows, setBaseRows] = useState<Row[] | null>(null);
  const [levels, setLevels] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const build = useCallback(() => {
    const rows = getRows().filter((r) => matchesFilter(r, filter));
    setBaseRows(rows);
    setSelected((prev) => repairSelection(rows, levels, prev, measureColumn, measureFn));
  }, [getRows, filter, levels, measureColumn, measureFn]);

  // Pull an initial snapshot as soon as the grid is live.
  useEffect(() => {
    if (gridReady && baseRows === null) build();
  }, [gridReady, baseRows, build]);

  // rowsPerLevel[i] = rows feeding level i (after applying selections 0..i-1)
  const rowsPerLevel = useMemo(() => {
    const out: Row[][] = [];
    let cur = baseRows ?? [];
    out.push(cur);
    for (let i = 0; i < levels.length; i++) {
      cur = cur.filter((r) => keyOf(r, levels[i]) === selected[i]);
      out.push(cur);
    }
    return out;
  }, [baseRows, levels, selected]);

  const nodesPerLevel = useMemo(
    () =>
      levels.map((field, i) => computeNodes(rowsPerLevel[i] ?? [], field, measureColumn, measureFn)),
    [levels, rowsPerLevel, measureColumn, measureFn]
  );

  const total = useMemo(
    () => computeMeasure(baseRows ?? [], measureColumn, measureFn),
    [baseRows, measureColumn, measureFn]
  );

  const availableFields = useMemo(
    () => columns.filter((c) => c !== measureColumn && !levels.includes(c)),
    [columns, measureColumn, levels]
  );

  const selectNode = (levelIndex: number, value: string) => {
    const next = [...selected];
    next[levelIndex] = value;
    setSelected(repairSelection(baseRows ?? [], levels, next, measureColumn, measureFn));
  };

  const addLevel = (field: string, presetValue?: string) => {
    const nextLevels = [...levels, field];
    const nextSelected = [...selected, presetValue ?? ""];
    setLevels(nextLevels);
    setSelected(repairSelection(baseRows ?? [], nextLevels, nextSelected, measureColumn, measureFn));
    setMenu(null);
  };

  const removeLevel = (levelIndex: number) => {
    setLevels(levels.slice(0, levelIndex));
    setSelected(selected.slice(0, levelIndex));
  };

  const runAiSplit = (mode: "high" | "low") => {
    const rows = rowsPerLevel[levels.length] ?? [];
    const found = aiSplit(rows, availableFields, measureColumn, measureFn, mode);
    if (found) addLevel(found.field, found.value);
    else setMenu(null);
  };

  // ---- ribbon geometry -------------------------------------------------
  const contentRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const colRefs = useRef<Map<number, HTMLElement>>(new Map());
  const [paths, setPaths] = useState<{ d: string; selected: boolean }[]>([]);
  const [contentWidth, setContentWidth] = useState(0);
  const rafRef = useRef<number | null>(null);

  const registerNode = useCallback((key: string, el: HTMLElement | null) => {
    if (el) nodeRefs.current.set(key, el);
    else nodeRefs.current.delete(key);
  }, []);

  const registerColumn = useCallback((index: number, el: HTMLElement | null) => {
    if (el) colRefs.current.set(index, el);
    else colRefs.current.delete(index);
  }, []);

  const measureRibbons = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const origin = content.getBoundingClientRect();
    const next: { d: string; selected: boolean }[] = [];

    for (let i = 0; i < levels.length; i++) {
      const parentEl = nodeRefs.current.get(i === 0 ? ROOT_KEY : `${i - 1}:${selected[i - 1]}`);
      const parentCol = colRefs.current.get(i - 1);
      const childCol = colRefs.current.get(i);
      if (!parentEl || !parentCol || !childCol) continue;

      const pr = parentEl.getBoundingClientRect();
      const pcr = parentCol.getBoundingClientRect();
      const py = pr.top + pr.height / 2;
      // skip when the parent is scrolled out of its own column
      if (py < pcr.top - 1 || py > pcr.bottom + 1) continue;

      const ccr = childCol.getBoundingClientRect();
      for (const node of nodesPerLevel[i] ?? []) {
        const el = nodeRefs.current.get(`${i}:${node.value}`);
        if (!el) continue;
        const cr = el.getBoundingClientRect();
        const cy = cr.top + cr.height / 2;
        if (cy < ccr.top - 1 || cy > ccr.bottom + 1) continue;

        const x1 = pr.right - origin.left;
        const y1 = py - origin.top;
        const x2 = cr.left - origin.left;
        const y2 = cy - origin.top;
        const mx = (x1 + x2) / 2;
        next.push({
          d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
          selected: node.value === selected[i],
        });
      }
    }
    setPaths(next);
    setContentWidth(content.scrollWidth);
  }, [levels, selected, nodesPerLevel]);

  const scheduleMeasure = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      measureRibbons();
    });
  }, [measureRibbons]);

  useLayoutEffect(() => {
    measureRibbons();
  }, [measureRibbons, focused, baseRows]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [scheduleMeasure, focused]);

  // ---- focus mode ------------------------------------------------------
  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menu) setMenu(null);
        else setFocused(false);
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [focused, menu]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

  const measureLabel =
    measureFn === "count"
      ? measureColumn === "*"
        ? "Count of rows"
        : `Count of ${measureColumn}`
      : `Sum of ${measureColumn}`;

  const columnHeight = focused ? "calc(100vh - 250px)" : "352px";

  const controls = (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs text-[var(--text-muted)]">Measure</label>
        <select
          value={measureFn}
          onChange={(e) => {
            const fn = e.target.value as MeasureFn;
            setMeasureFn(fn);
            if (fn === "sum" && !numCols.includes(measureColumn)) setMeasureColumn(numCols[0] ?? "");
          }}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="sum" disabled={numCols.length === 0}>
            Sum
          </option>
          <option value="count">Count</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--text-muted)]">of</label>
        <select
          value={measureColumn}
          onChange={(e) => setMeasureColumn(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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
        <label className="mb-1 block text-xs text-[var(--text-muted)]">Filter (optional)</label>
        <FilterEditor columns={columns} value={filter} onChange={setFilter} />
      </div>
      <button
        type="button"
        onClick={build}
        className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
      >
        {baseRows === null ? "Build tree" : "Refresh"}
      </button>
      {levels.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setLevels([]);
            setSelected([]);
          }}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-alt)]"
        >
          Reset
        </button>
      )}
    </div>
  );

  const canvas = (
    <div className="thin-scroll overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div ref={contentRef} className="relative inline-flex items-start gap-14">
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            {/* userSpaceOnUse: a perfectly horizontal ribbon has a zero-height
                bounding box, and an objectBoundingBox gradient refuses to paint one */}
            <linearGradient
              id="decompRibbon"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={Math.max(contentWidth, 1)}
              y2="0"
            >
              <stop offset="0%" stopColor="#515bd4" />
              <stop offset="50%" stopColor="#dd2a7b" />
              <stop offset="100%" stopColor="#f58529" />
            </linearGradient>
          </defs>
          {paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill="none"
              stroke={p.selected ? "url(#decompRibbon)" : "#dbdbdb"}
              strokeWidth={p.selected ? 2.25 : 1.25}
            />
          ))}
        </svg>

        {/* root */}
        <div className="relative z-10 w-52 shrink-0">
          <div className="mb-2 truncate pr-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {measureLabel}
          </div>
          <div
            ref={(el) => registerColumn(-1, el)}
            className="thin-scroll overflow-y-auto pr-5"
            style={{ maxHeight: columnHeight }}
            onScroll={scheduleMeasure}
          >
            <NodeCard
              nodeKey={ROOT_KEY}
              label="Total"
              measure={total}
              share={null}
              barPct={100}
              selected
              registerNode={registerNode}
              onSelect={() => {}}
              showPlus={levels.length === 0 && availableFields.length > 0}
              onPlus={(x, y) => setMenu({ x, y })}
            />
          </div>
        </div>

        {levels.map((field, i) => {
          const nodes = nodesPerLevel[i] ?? [];
          const parentValue = computeMeasure(rowsPerLevel[i] ?? [], measureColumn, measureFn);
          const maxAbs = Math.max(...nodes.map((n) => Math.abs(n.measure)), 1);
          const isLast = i === levels.length - 1;
          return (
            <div key={`${field}-${i}`} className="relative z-10 w-52 shrink-0">
              <div className="mb-2 flex items-center justify-between gap-1 pr-5">
                <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {field}
                </span>
                <button
                  type="button"
                  onClick={() => removeLevel(i)}
                  title={`Remove "${field}" level`}
                  className="shrink-0 rounded-full px-1 text-xs leading-none text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--danger)]"
                >
                  ✕
                </button>
              </div>
              <div
                ref={(el) => registerColumn(i, el)}
                className="thin-scroll space-y-2 overflow-y-auto pr-5"
                style={{ maxHeight: columnHeight }}
                onScroll={scheduleMeasure}
              >
                {nodes.map((node) => (
                  <NodeCard
                    key={node.value}
                    nodeKey={`${i}:${node.value}`}
                    label={node.value}
                    measure={node.measure}
                    share={parentValue !== 0 ? (node.measure / parentValue) * 100 : null}
                    barPct={(Math.abs(node.measure) / maxAbs) * 100}
                    selected={node.value === selected[i]}
                    registerNode={registerNode}
                    onSelect={() => selectNode(i, node.value)}
                    showPlus={isLast && availableFields.length > 0}
                    plusOnHoverOnly={isLast && node.value !== selected[i]}
                    onPlus={(x, y) => {
                      if (node.value !== selected[i]) selectNode(i, node.value);
                      setMenu({ x, y });
                    }}
                  />
                ))}
                {nodes.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">No values.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  let body: React.ReactNode;
  if (!gridReady || baseRows === null) {
    body = (
      <p className="text-xs text-[var(--text-muted)]">
        Loading rows from the grid… if nothing appears, click "Build tree".
      </p>
    );
  } else if (baseRows.length === 0) {
    body = <p className="text-xs text-[var(--danger)]">No rows match the current filter.</p>;
  } else {
    body = (
      <>
        {canvas}
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Click <strong>+</strong> on a node to add a level, click any value to drill into it
          (deeper levels stay and recompute), and use a level's ✕ to remove it. Built from the
          grid's filtered rows at the time you last hit Build tree / Refresh.
        </p>
      </>
    );
  }

  const menuPanel = menu && (
    <div
      className="fixed z-[60] w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-xl"
      style={{ left: Math.min(menu.x, window.innerWidth - 240), top: Math.min(menu.y, window.innerHeight - 320) }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        AI splits
      </div>
      <button
        type="button"
        onClick={() => runAiSplit("high")}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-alt)]"
      >
        <span className="ig-gradient-text font-bold">✦</span> High value
      </button>
      <button
        type="button"
        onClick={() => runAiSplit("low")}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-alt)]"
      >
        <span className="ig-gradient-text font-bold">✦</span> Low value
      </button>
      <div className="my-1 border-t border-[var(--border)]" />
      <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Fields
      </div>
      <div className="thin-scroll max-h-56 overflow-y-auto">
        {availableFields.map((field) => (
          <button
            key={field}
            type="button"
            onClick={() => addLevel(field)}
            className="block w-full truncate px-3 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-alt)]"
          >
            {field}
          </button>
        ))}
      </div>
    </div>
  );

  if (focused) {
    return (
      <>
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-[var(--text)]">Decompose</h3>
            <button
              type="button"
              onClick={() => setFocused(false)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-alt)]"
            >
              Close
            </button>
          </div>
          {controls}
          <div className="min-h-0 flex-1 overflow-auto">{body}</div>
        </div>
        {menuPanel}
      </>
    );
  }

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">Decompose</h3>
        <button
          type="button"
          onClick={() => setFocused(true)}
          className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-alt)]"
        >
          Expand
        </button>
      </div>
      {controls}
      {body}
      {menuPanel}
    </div>
  );
}

function NodeCard({
  nodeKey,
  label,
  measure,
  share,
  barPct,
  selected,
  registerNode,
  onSelect,
  showPlus,
  plusOnHoverOnly,
  onPlus,
}: {
  nodeKey: string;
  label: string;
  measure: number;
  share: number | null;
  barPct: number;
  selected: boolean;
  registerNode: (key: string, el: HTMLElement | null) => void;
  onSelect: () => void;
  showPlus?: boolean;
  plusOnHoverOnly?: boolean;
  onPlus?: (x: number, y: number) => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        ref={(el) => registerNode(nodeKey, el)}
        onClick={onSelect}
        title={`${label} — ${measure.toLocaleString()}`}
        className={`w-full rounded-xl border-2 bg-[var(--surface)] px-3 py-2 text-left transition-colors ${
          selected
            ? "border-[var(--accent)]"
            : "border-[var(--border)] hover:border-[var(--border-strong)]"
        }`}
      >
        <div className="truncate text-[13px] font-semibold text-[var(--text)]">{label}</div>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="text-[13px] tabular-nums text-[var(--text)]">{abbreviate(measure)}</span>
          {share !== null && (
            <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
              {share.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-alt)]">
          <div
            className={selected ? "h-full rounded-full ig-gradient" : "h-full rounded-full bg-[#dbdbdb]"}
            style={{ width: `${Math.max(barPct, 2)}%` }}
          />
        </div>
      </button>
      {showPlus && (
        <button
          type="button"
          title="Add a level"
          onClick={(e) => {
            e.stopPropagation();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onPlus?.(r.right + 6, r.top);
          }}
          className={`absolute -right-3.5 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-bold leading-none text-[var(--accent)] shadow-sm hover:border-[var(--accent)] ${
            plusOnHoverOnly ? "opacity-0 group-hover:opacity-100 focus:opacity-100" : ""
          }`}
        >
          +
        </button>
      )}
    </div>
  );
}
