import { UTFVI_COLORS, UTFVI_LABELS, tempHex } from "../map/palette";
import type { Meta } from "../types";

export const fmt = (n: number | null | undefined, d = 1) => (n === null || n === undefined || !isFinite(n) ? "—" : n.toFixed(d));
export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}`;

/** Barra apilada con el % de área en cada clase UTFVI. */
export function ClassBar({ clases, compact = false }: { clases: number[]; compact?: boolean }) {
  return (
    <div className={`classbar ${compact ? "is-compact" : ""}`}>
      <div className="classbar-track" role="img" aria-label={clases.map((p, i) => `${UTFVI_LABELS[i]} ${p}%`).join(", ")}>
        {clases.map((p, i) =>
          p > 0 ? <span key={i} style={{ width: `${p}%`, background: UTFVI_COLORS[i] }} title={`${UTFVI_LABELS[i]}: ${p}%`} /> : null,
        )}
      </div>
      {!compact && (
        <div className="classbar-keys">
          {clases.map((p, i) => (
            <span key={i}>
              <i style={{ background: UTFVI_COLORS[i] }} />
              {UTFVI_LABELS[i]} <b>{fmt(p, 0)}%</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cifra principal: temperatura media y diferencia con la media metropolitana. */
export function BigTemp({ value, dif, label }: { value: number; dif?: number; label: string }) {
  return (
    <div className="bigtemp">
      <div className="bigtemp-swatch" style={{ background: tempHex(value) }} />
      <div>
        <div className="bigtemp-value">
          {fmt(value)}
          <small>°C</small>
        </div>
        <div className="bigtemp-label">{label}</div>
      </div>
      {dif !== undefined && (
        <div className={`chip ${dif > 0.3 ? "is-hot" : dif < -0.3 ? "is-cool" : ""}`}>
          {signed(dif)} °C<span>vs media</span>
        </div>
      )}
    </div>
  );
}

/** Perfil de LST vs distancia al límite del Suelo de Conservación. */
export function ProfileChart({ meta }: { meta: Meta }) {
  const W = 340;
  const H = 180;
  const P = { l: 30, r: 10, t: 24, b: 30 };
  const data = meta.perfil;
  const x0 = -2;
  const x1 = 6;
  const ys = data.flatMap((d) => [d.p25, d.p75]);
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  const sx = (x: number) => P.l + ((x - x0) / (x1 - x0)) * (W - P.l - P.r);
  const sy = (y: number) => H - P.b - ((y - y0) / (y1 - y0)) * (H - P.t - P.b);
  const line = data.map((d, i) => `${i ? "L" : "M"}${sx(d.d).toFixed(1)},${sy(d.media).toFixed(1)}`).join("");
  const band =
    data.map((d, i) => `${i ? "L" : "M"}${sx(d.d).toFixed(1)},${sy(d.p75).toFixed(1)}`).join("") +
    [...data].reverse().map((d) => `L${sx(d.d).toFixed(1)},${sy(d.p25).toFixed(1)}`).join("") +
    "Z";
  const yTicks = [];
  for (let y = y0; y <= y1; y += 2) yTicks.push(y);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Temperatura media según la distancia al límite del Suelo de Conservación">
        <rect x={sx(-2)} y={P.t} width={sx(0) - sx(-2)} height={H - P.t - P.b} className="chart-sc" />
        <rect x={sx(0)} y={P.t} width={sx(1) - sx(0)} height={H - P.t - P.b} className="chart-edge" />
        {yTicks.map((y) => (
          <g key={y}>
            <line x1={P.l} x2={W - P.r} y1={sy(y)} y2={sy(y)} className="chart-grid" />
            <text x={P.l - 6} y={sy(y) + 3.5} textAnchor="end" className="chart-tick">
              {y}°
            </text>
          </g>
        ))}
        {[-2, 0, 2, 4, 6].map((x) => (
          <text key={x} x={sx(x)} y={H - P.b + 14} textAnchor="middle" className="chart-tick">
            {x > 0 ? `+${x}` : x}
          </text>
        ))}
        <path d={band} className="chart-band" />
        <path d={line} className="chart-line" />
        <line x1={sx(0)} x2={sx(0)} y1={P.t - 4} y2={H - P.b} className="chart-zero" />
        <text x={sx(-1)} y={P.t - 8} textAnchor="middle" className="chart-ann">
          suelo de conservación
        </text>
        <text x={sx(3.5)} y={P.t - 8} textAnchor="middle" className="chart-ann">
          ciudad →
        </text>
        <text x={(W + P.l) / 2} y={H - 3} textAnchor="middle" className="chart-axis">
          distancia al límite (km)
        </text>
      </svg>
      <figcaption>Media de LST cada 250 m (línea) y rango intercuartil (banda).</figcaption>
    </figure>
  );
}

/** Barras horizontales: media por zona. */
export function RankBars({ rows, unit = "°C" }: { rows: { label: string; value: number; sub?: string }[]; unit?: string }) {
  const lo = Math.min(...rows.map((r) => r.value)) - 1.5;
  const hi = Math.max(...rows.map((r) => r.value)) + 0.3;
  return (
    <div className="rankbars">
      {rows.map((r) => (
        <div className="rankbar" key={r.label}>
          <span className="rankbar-label">{r.label}</span>
          <span className="rankbar-track">
            <span style={{ width: `${((r.value - lo) / (hi - lo)) * 100}%`, background: tempHex(r.value) }} />
          </span>
          <span className="rankbar-value">
            {fmt(r.value)}
            <small>{unit}</small>
          </span>
          {r.sub && <span className="rankbar-sub">{r.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/** Histograma de LST coloreado por clase UTFVI. */
export function Histogram({ meta }: { meta: Meta }) {
  const { bins, n } = meta.histograma;
  const max = Math.max(...n);
  const W = 340;
  const H = 64;
  const bw = W / n.length;
  const cls = (t: number) => meta.umbrales_c.filter((u) => t >= u).length;
  const sx = (t: number) => ((t - bins[0]) / (bins[bins.length - 1] - bins[0])) * W;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H + 16}`} role="img" aria-label="Distribución de temperaturas">
        {n.map((v, i) => (
          <rect key={i} x={i * bw + 0.5} width={bw - 1} y={H - (v / max) * H} height={(v / max) * H} fill={UTFVI_COLORS[cls(bins[i] + 0.25)]} />
        ))}
        <line x1={sx(meta.t_media)} x2={sx(meta.t_media)} y1={0} y2={H} className="chart-zero" />
        <text x={sx(meta.t_media) + 4} y={10} className="chart-ann" textAnchor="start">
          media {fmt(meta.t_media)}°
        </text>
        {[15, 20, 25, 30, 35, 40, 45].map((t) => (
          <text key={t} x={sx(t)} y={H + 13} textAnchor="middle" className="chart-tick">
            {t}°
          </text>
        ))}
      </svg>
    </figure>
  );
}
