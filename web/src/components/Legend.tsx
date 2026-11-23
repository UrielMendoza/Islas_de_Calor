import type { AppData, LayerState } from "../types";
import { UTFVI_COLORS, UTFVI_LABELS, rampStops, tempPos } from "../map/palette";
import { fmt } from "./charts";

export function Legend({ layers, data, hoverT }: { layers: LayerState; data: AppData; hoverT: number | null }) {
  const m = data.meta;
  const stops = rampStops();
  const showThermal = layers.thermal !== "none" || layers.malla || (layers.edificios && layers.edificiosColor === "temperatura");
  const mode = layers.thermal === "none" ? "lst" : layers.thermal;
  const pos = (t: number) => `${tempPos(t) * 100}%`;
  const filtered = layers.range[0] > Math.floor(m.t_min) || layers.range[1] < Math.ceil(m.t_max);

  return (
    <div className="legend" aria-label="Simbología">
      {showThermal && mode === "lst" && (
        <div className="lg-block">
          <div className="lg-title">
            Temperatura superficial <span>LST · °C</span>
          </div>
          <div className="lg-ramp" style={{ background: `linear-gradient(90deg, ${UTFVI_COLORS.join(",")})` }}>
            {hoverT !== null && <span className="lg-cursor" style={{ left: pos(hoverT) }} />}
            {filtered && (
              <>
                <span className="lg-mask" style={{ left: 0, width: pos(layers.range[0]) }} />
                <span className="lg-mask" style={{ left: pos(layers.range[1]), right: 0 }} />
              </>
            )}
          </div>
          <div className="lg-ticks">
            {stops.map((s, i) => (
              <span key={i}>
                {i === 0 ? "≤" : i === stops.length - 1 ? "≥" : ""}
                {fmt(s, 0)}
              </span>
            ))}
          </div>
          <div className="lg-note">Colores anclados en percentiles (p2 a p99)</div>
        </div>
      )}
      {showThermal && mode === "utfvi" && (
        <div className="lg-block">
          <div className="lg-title">
            Índice UTFVI <span>6 clases</span>
          </div>
          <ul className="lg-classes">
            {UTFVI_LABELS.map((l, i) => {
              const lo = i === 0 ? null : m.umbrales_c[i - 1];
              const hi = i === 5 ? null : m.umbrales_c[i];
              const off = (lo !== null && lo >= layers.range[1]) || (hi !== null && hi <= layers.range[0]);
              const on = hoverT !== null && (lo === null || hoverT >= lo) && (hi === null || hoverT < hi);
              return (
                <li key={l} className={`${off ? "is-off" : ""} ${on ? "is-hover" : ""}`}>
                  <i style={{ background: UTFVI_COLORS[i] }} />
                  {l}
                  <small>{lo === null ? `<${fmt(hi!)}` : hi === null ? `≥${fmt(lo)}` : `${fmt(lo)}–${fmt(hi)}`}°</small>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {(layers.sc || layers.transicion || layers.zonas || layers.zonasTinte || layers.verde) && (
        <ul className="lg-lines">
          {layers.sc && (
            <li>
              <i className="sw sw-sc" />
              Suelo de Conservación
            </li>
          )}
          {layers.transicion && (
            <>
              <li>
                <i className="sw sw-trans" />
                Borde urbano 0–1 km
              </li>
              <li>
                <i className="sw sw-trans-in" />
                Urbanización dentro del SC
              </li>
            </>
          )}
          {layers.zonas && (
            <li>
              <i className="sw sw-zona" />
              Zona de interés
            </li>
          )}
          {layers.zonasTinte && (
            <li>
              <i className="sw sw-zonas" />
              Zonas de análisis (5)
            </li>
          )}
          {layers.verde && (
            <li>
              <i className="sw sw-verde" />
              Parques y vegetación OSM
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
