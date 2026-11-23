import type { AppData, LayerState, Thermal } from "../types";
import { BASEMAPS } from "../map/basemaps";
import { fmt } from "./charts";

interface Props {
  layers: LayerState;
  set: (patch: Partial<LayerState>) => void;
  basemap: string;
  setBasemap: (id: string) => void;
  data: AppData;
  onZona: (id: string) => void;
  onClose: () => void;
}

function Toggle({ on, label, hint, swatch, onChange }: { on: boolean; label: string; hint?: string; swatch?: React.ReactNode; onChange: (v: boolean) => void }) {
  return (
    <label className={`toggle ${on ? "is-on" : ""}`}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-switch" aria-hidden />
      {swatch && <span className="toggle-swatch">{swatch}</span>}
      <span className="toggle-text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function LayerPanel({ layers, set, basemap, setBasemap, data, onZona, onClose }: Props) {
  const m = data.meta;
  const min = Math.floor(m.t_min);
  const max = Math.ceil(m.t_max);
  const thermalOpts: { id: Thermal; label: string }[] = [
    { id: "lst", label: "LST °C" },
    { id: "utfvi", label: "UTFVI" },
    { id: "none", label: "Ninguna" },
  ];

  return (
    <aside className="panel" aria-label="Panel de capas">
      <header className="panel-head">
        <h3>Capas</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar panel">
          ×
        </button>
      </header>

      <div className="panel-body">
        <section className="pgroup">
          <h4>Temperatura</h4>
          <div className="seg" role="radiogroup" aria-label="Capa térmica">
            {thermalOpts.map((o) => (
              <button key={o.id} role="radio" aria-checked={layers.thermal === o.id} className={layers.thermal === o.id ? "is-on" : ""} onClick={() => set({ thermal: o.id })}>
                {o.label}
              </button>
            ))}
          </div>

          <div className="slider-row">
            <span>Rango visible</span>
            <b>
              {fmt(layers.range[0], 0)}–{fmt(layers.range[1], 0)} °C
            </b>
          </div>
          <div className="dual">
            <input
              type="range"
              min={min}
              max={max}
              step={0.5}
              value={layers.range[0]}
              onChange={(e) => set({ range: [Math.min(+e.target.value, layers.range[1] - 0.5), layers.range[1]] })}
              aria-label="Temperatura mínima visible"
            />
            <input
              type="range"
              min={min}
              max={max}
              step={0.5}
              value={layers.range[1]}
              onChange={(e) => set({ range: [layers.range[0], Math.max(+e.target.value, layers.range[0] + 0.5)] })}
              aria-label="Temperatura máxima visible"
            />
          </div>
          <div className="quick">
            <button onClick={() => set({ range: [m.umbrales_c[3], max] })}>Sólo islas de calor</button>
            <button onClick={() => set({ range: [min, m.umbrales_c[0]] })}>Sólo zonas frescas</button>
            <button onClick={() => set({ range: [min, max] })}>Todo</button>
          </div>

          <div className="slider-row">
            <span>Opacidad</span>
            <b>{Math.round(layers.opacity * 100)}%</b>
          </div>
          <input type="range" min={0.1} max={1} step={0.05} value={layers.opacity} onChange={(e) => set({ opacity: +e.target.value })} aria-label="Opacidad de la capa térmica" />

          <Toggle on={layers.malla} label="Malla 500 m en 3D" hint="Altura y color según la LST media" onChange={(v) => set({ malla: v })} />
        </section>

        <section className="pgroup">
          <h4>Edificios 3D</h4>
          <Toggle on={layers.edificios} label="Mostrar edificios" hint="OpenStreetMap · visibles desde zoom 13.5" onChange={(v) => set({ edificios: v })} />
          <div className="seg" role="radiogroup" aria-label="Color de los edificios">
            <button className={layers.edificiosColor === "neutro" ? "is-on" : ""} onClick={() => set({ edificiosColor: "neutro", edificios: true })}>
              Neutro
            </button>
            <button className={layers.edificiosColor === "temperatura" ? "is-on" : ""} onClick={() => set({ edificiosColor: "temperatura", edificios: true })}>
              Por temperatura
            </button>
          </div>
        </section>

        <section className="pgroup">
          <h4>Límites y zonas</h4>
          <Toggle on={layers.alcaldias} label="Alcaldías CDMX" swatch={<i className="sw sw-line" />} onChange={(v) => set({ alcaldias: v })} />
          <Toggle on={layers.zonasTinte} label="Zonas de análisis" hint="Norte · Centro · Poniente · Oriente · Sur" swatch={<i className="sw sw-zonas" />} onChange={(v) => set({ zonasTinte: v })} />
          <Toggle on={layers.periferia} label="Municipios de la periferia" hint="Estado de México" swatch={<i className="sw sw-dash" />} onChange={(v) => set({ periferia: v })} />
          <Toggle on={layers.sc} label="Suelo de Conservación" hint="Límite urbano–natural oficial" swatch={<i className="sw sw-sc" />} onChange={(v) => set({ sc: v })} />
          <Toggle on={layers.transicion} label="Franja de transición" hint="±1 km del límite" swatch={<i className="sw sw-trans" />} onChange={(v) => set({ transicion: v })} />
          <Toggle on={layers.zonas} label="Zonas de interés" hint="Recorrido · datos de prueba" swatch={<i className="sw sw-zona" />} onChange={(v) => set({ zonas: v })} />
        </section>

        <section className="pgroup">
          <h4>Contexto</h4>
          <Toggle on={layers.verde} label="Parques y vegetación (OSM)" swatch={<i className="sw sw-verde" />} onChange={(v) => set({ verde: v })} />
          <Toggle on={layers.relieve} label="Relieve 3D y sombreado" hint="Modelo de elevación Terrarium" onChange={(v) => set({ relieve: v })} />
        </section>

        <section className="pgroup">
          <h4>Mapa base</h4>
          <div className="basemaps">
            {BASEMAPS.map((b) => (
              <button key={b.id} className={`basemap basemap-${b.id} ${basemap === b.id ? "is-on" : ""}`} onClick={() => setBasemap(b.id)} title={b.hint}>
                <span className="basemap-thumb" aria-hidden />
                {b.label}
              </button>
            ))}
          </div>
        </section>

        <section className="pgroup">
          <h4>Ir a zona</h4>
          <ul className="zlist">
            {data.zonas.features.map((f) => (
              <li key={f.properties.id}>
                <button onClick={() => onZona(f.properties.id)}>
                  <span>{f.properties.nombre}</span>
                  <b className={f.properties.s_dif > 0.3 ? "t-hot" : f.properties.s_dif < -0.3 ? "t-cool" : ""}>{fmt(f.properties.s_media)}°</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}
