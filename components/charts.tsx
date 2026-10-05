"use client";
import { useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Fixed categorical order; colour follows the entity, never its rank. */
export const SERIES = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];
export type Series = { key: string; name?: string; color?: string };
type Row = Record<string, string | number>;

const tick = { fill: "var(--muted)", fontSize: 11 };
const tip = {
  contentStyle: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)", fontSize: 12 },
  labelStyle: { color: "var(--ink)", fontWeight: 600 }, itemStyle: { color: "var(--ink)" },
};
const legendText = (v: string) => <span style={{ color: "var(--ink)", fontSize: 12 }}>{v}</span>;

/** Every chart has a table view so the data never depends on colour or hover. */
export function ChartCard({ title, subtitle, children, table, actions }: {
  title: string; subtitle?: string; children: ReactNode; actions?: ReactNode; table?: { head: string[]; rows: (string | number)[][] };
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="rounded-lg border border-line bg-panel p-4" aria-label={title}>
      <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="font-semibold">{title}</h3>{subtitle && <p className="text-xs text-muted">{subtitle}</p>}</div>
        <div className="flex items-center gap-2">
          {actions}
          {table && <button aria-pressed={asTable} onClick={() => setAsTable((v) => !v)} className="rounded border border-line px-2 py-0.5 text-xs text-muted hover:text-ink">{asTable ? "Chart" : "Table"}</button>}
        </div>
      </header>
      {asTable && table ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead><tr>{table.head.map((h) => <th key={h} className="sticky top-0 bg-panel py-1 pr-3 text-xs font-medium text-muted">{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className="py-1 pr-3">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : children}
    </section>
  );
}

export function tableOf(data: Row[], xKey: string, series: Series[], fmt: (n: number) => string = String) {
  return { head: [xKey === "label" ? "Period" : xKey, ...series.map((s) => s.name ?? s.key)], rows: data.map((d) => [d[xKey], ...series.map((s) => fmt(Number(d[s.key] ?? 0)))]) };
}

export function TrendChart({ data, xKey = "label", series, kind = "bar", format = (n) => String(n), height = 240, stacked = false, label }: {
  data: Row[]; xKey?: string; series: Series[]; kind?: "bar" | "area" | "line"; format?: (n: number) => string; height?: number; stacked?: boolean; label: string;
}) {
  const color = (s: Series, i: number) => s.color ?? SERIES[i % SERIES.length];
  const common = { data, margin: { top: 8, right: 8, left: 0, bottom: 0 } };
  const axes = (<>
    <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
    <XAxis dataKey={xKey} tick={tick} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval="preserveStartEnd" minTickGap={16} />
    <YAxis tick={tick} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => format(Number(v))} allowDecimals={false} />
    <Tooltip {...tip} cursor={{ fill: "var(--line)", opacity: 0.4 }} formatter={(v) => format(Number(v))} />
    {series.length > 1 && <Legend iconType="circle" formatter={legendText} />}
  </>);
  return (
    <div role="img" aria-label={label} style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {kind === "bar" ? (
          <BarChart {...common}>{axes}{series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={color(s, i)} stackId={stacked ? "a" : undefined} radius={stacked ? 0 : [4, 4, 0, 0]} maxBarSize={32} stroke="var(--panel)" strokeWidth={stacked ? 2 : 0} />)}</BarChart>
        ) : kind === "area" ? (
          <AreaChart {...common}>{axes}{series.map((s, i) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={color(s, i)} fill={color(s, i)} fillOpacity={0.15} strokeWidth={2} activeDot={{ r: 4, stroke: "var(--panel)", strokeWidth: 2 }} />)}</AreaChart>
        ) : (
          <LineChart {...common}>{axes}{series.map((s, i) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={color(s, i)} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--panel)", strokeWidth: 2 }} />)}</LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars for ranked/categorical values. Clicking a bar calls onSelect(name). */
export function HBars({ data, format = (n) => String(n), onSelect, selected, height, label, max }: {
  data: { name: string; value: number }[]; format?: (n: number) => string; onSelect?: (name: string) => void; selected?: string | null; height?: number; label: string; max?: number;
}) {
  const h = height ?? Math.max(120, data.length * 34 + 16);
  return (
    <div role="img" aria-label={label} style={{ height: h }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" hide domain={[0, max ?? "auto"]} />
          <YAxis type="category" dataKey="name" tick={{ ...tick, fontSize: 12 }} tickLine={false} axisLine={false} width={96} />
          <Tooltip {...tip} cursor={{ fill: "var(--line)", opacity: 0.4 }} formatter={(v) => format(Number(v))} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16} onClick={(d) => onSelect?.(String((d as unknown as { name: string }).name))} cursor={onSelect ? "pointer" : undefined}>
            {data.map((d) => <Cell key={d.name} fill={SERIES[0]} fillOpacity={selected && selected !== d.name ? 0.35 : 1} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut + clickable legend list with shares. Selecting a slice or legend row drills down in the parent. */
export function Donut({ data, format, onSelect, selected, label, total }: {
  data: { name: string; value: number }[]; format: (n: number) => string; onSelect?: (name: string | null) => void; selected?: string | null; label: string; total?: string;
}) {
  const sum = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="grid items-center gap-3 sm:grid-cols-2">
      <div role="img" aria-label={label} className="relative h-52 min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Tooltip {...tip} formatter={(v) => format(Number(v))} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={0} stroke="var(--panel)" strokeWidth={2}
              onClick={(_, i) => onSelect?.(selected === data[i].name ? null : data[i].name)} cursor={onSelect ? "pointer" : undefined}>
              {data.map((d, i) => <Cell key={d.name} fill={SERIES[i % SERIES.length]} fillOpacity={selected && selected !== d.name ? 0.3 : 1} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {total && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="text-xs text-muted">Total</p><p className="font-bold">{total}</p></div></div>}
      </div>
      <ul className="space-y-1 text-sm">
        {data.map((d, i) => (
          <li key={d.name}>
            <button onClick={() => onSelect?.(selected === d.name ? null : d.name)} aria-pressed={selected === d.name}
              className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-line ${selected === d.name ? "bg-line" : ""}`}>
              <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
              <span className="flex-1 truncate">{d.name}</span>
              <span className="text-muted">{sum ? Math.round((d.value / sum) * 100) : 0}%</span>
              <span className="w-20 text-right">{format(d.value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Calendar heatmap: one hue, intensity = share of habits done that day. */
export function Heatmap({ cells }: { cells: { date: string; value: number; label: string }[] }) {
  if (!cells.length) return null;
  const lead = (new Date(`${cells[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <ol className="grid grid-flow-col grid-rows-7 gap-1" style={{ width: "max-content" }} aria-label="Habit completion heatmap">
          {Array.from({ length: lead }, (_, i) => <li key={`p${i}`} aria-hidden className="size-3.5" />)}
          {cells.map((c) => (
            <li key={c.date} title={c.label} aria-label={c.label} className="size-3.5 rounded-sm border border-line"
              style={{ background: c.value > 0 ? `color-mix(in srgb, var(--c1) ${Math.round(25 + c.value * 75)}%, transparent)` : "transparent" }} />
          ))}
        </ol>
      </div>
      <p className="mt-2 flex items-center gap-1 text-xs text-muted">Less
        {[0, 0.25, 0.5, 0.75, 1].map((v) => <span key={v} aria-hidden className="inline-block size-3 rounded-sm border border-line" style={{ background: v ? `color-mix(in srgb, var(--c1) ${25 + v * 75}%, transparent)` : "transparent" }} />)}
        More</p>
    </div>
  );
}
