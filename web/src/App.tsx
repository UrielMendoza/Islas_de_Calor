import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MlMap } from "maplibre-gl";
import type { AppData, Camera, LayerState } from "./types";
import { LstGrid } from "./map/lstGrid";
import { BASEMAPS } from "./map/basemaps";
import { CHAPTERS } from "./story";
import { MapView, describeT, type Hover } from "./components/MapView";
import { StoryPanel } from "./components/StoryPanel";
import { LayerPanel } from "./components/LayerPanel";
import { Legend } from "./components/Legend";
import { fmt, signed } from "./components/charts";
import { setRampStops } from "./map/palette";

const BASE = import.meta.env.BASE_URL + "data/";

async function loadAll(): Promise<{ data: AppData; grid: LstGrid }> {
  const j = (f: string) => fetch(BASE + f).then((r) => r.json());
  const [meta, alcaldias, periferia, conservacion, transicion, malla, zonas] = await Promise.all([
    j("meta.json"),
    j("alcaldias.geojson"),
    j("periferia.geojson"),
    j("conservacion.geojson"),
    j("transicion.geojson"),
    j("malla500.geojson"),
    j("zonas.geojson"),
  ]);
  const data: AppData = { meta, alcaldias, periferia, conservacion, transicion, malla, zonas };
  setRampStops(meta.rampa);
  const grid = await LstGrid.load(BASE + "lst_grid.png", meta);
  return { data, grid };
}

type Mode = "recorrido" | "explorar";

function initialLayers(d: AppData): LayerState {
  return {
    thermal: "lst",
    opacity: 0.85,
    range: [Math.floor(d.meta.t_min), Math.ceil(d.meta.t_max)],
    malla: false,
    edificios: false,
    edificiosColor: "temperatura",
    alcaldias: true,
    zonasTinte: false,
    periferia: true,
    sc: false,
    transicion: false,
    zonas: false,
    verde: false,
    relieve: false,
  };
}

const prefersDark = () => {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return true;
  }
};

export default function App() {
  const [loaded, setLoaded] = useState<{ data: AppData; grid: LstGrid } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAll()
      .then(setLoaded)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="splash">No se pudieron cargar los datos: {error}</div>;
  if (!loaded)
    return (
      <div className="splash">
        <div className="splash-mark" />
        <span>Cargando la termografía del valle…</span>
      </div>
    );
  return <Portal data={loaded.data} grid={loaded.grid} />;
}

function Portal({ data, grid }: { data: AppData; grid: LstGrid }) {
  const [mode, setMode] = useState<Mode>("recorrido");
  const [active, setActive] = useState(0);
  const [layers, setLayers] = useState<LayerState>(() => initialLayers(data));
  const [theme, setTheme] = useState<"dark" | "light">(() => (prefersDark() ? "dark" : "light"));
  const [basemap, setBasemap] = useState(theme === "dark" ? "dark" : "positron");
  const [panel, setPanel] = useState(false);
  const [camera, setCamera] = useState<{ cam: Camera; key: number } | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [nBuild, setNBuild] = useState(0);
  const mapRef = useRef<MlMap | null>(null);
  const [is3d, setIs3d] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const patch = useCallback((p: Partial<LayerState>) => setLayers((l) => ({ ...l, ...p })), []);

  const chapter = CHAPTERS[active];
  const focusZona = mode === "recorrido" ? chapter.focusZona ?? null : null;

  // cada capítulo aplica su cámara y sus capas
  useEffect(() => {
    if (mode !== "recorrido") return;
    patch({ range: [Math.floor(data.meta.t_min), Math.ceil(data.meta.t_max)], ...chapter.layers });
    setCamera({ cam: chapter.camera, key: Date.now() });
  }, [active, mode, chapter, patch, data]);

  const onMap = useCallback((m: MlMap) => {
    mapRef.current = m;
    m.on("pitchend", () => setIs3d(m.getPitch() > 5));
  }, []);

  const toggle3d = () => {
    const m = mapRef.current;
    if (!m) return;
    if (m.getPitch() > 5) {
      m.easeTo({ pitch: 0, bearing: 0, duration: 900 });
      patch({ edificios: false });
    } else {
      m.easeTo({ pitch: 58, bearing: -18, duration: 900, zoom: Math.max(m.getZoom(), 11) });
      patch({ edificios: true });
    }
  };

  const goZona = (id: string) => {
    const f = data.zonas.features.find((z) => z.properties.id === id);
    if (!f) return;
    const idx = CHAPTERS.findIndex((c) => c.focusZona === id);
    if (mode === "recorrido" && idx >= 0) {
      setActive(idx);
      return;
    }
    patch({ zonas: true, edificios: true });
    setCamera({ cam: { center: [f.properties.lon, f.properties.lat], zoom: 13.4, pitch: 60, bearing: -20 }, key: Date.now() });
  };

  const switchTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (basemap === "dark" || basemap === "positron") setBasemap(next === "dark" ? "dark" : "positron");
  };

  const enterExplore = () => {
    setMode("explorar");
    setPanel(true);
  };

  const hoverInfo = useMemo(() => (hover && hover.t !== null ? { ...describeT(hover.t, data.meta.umbrales_c), t: hover.t } : null), [hover, data]);
  const bm = BASEMAPS.find((b) => b.id === basemap)!;

  return (
    <div className={`app mode-${mode} ${panel ? "has-panel" : ""}`}>
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <h1>
              Islas de calor <em>del Valle de México</em>
            </h1>
            <p>Mapas, decisiones residenciales y calor urbano</p>
          </div>
        </div>
        <div className="modes" role="tablist" aria-label="Modo">
          <button role="tab" aria-selected={mode === "recorrido"} className={mode === "recorrido" ? "is-on" : ""} onClick={() => setMode("recorrido")}>
            Recorrido
          </button>
          <button role="tab" aria-selected={mode === "explorar"} className={mode === "explorar" ? "is-on" : ""} onClick={enterExplore}>
            Explorar
          </button>
        </div>
      </header>

      {mode === "recorrido" && <StoryPanel chapters={CHAPTERS} active={active} onActive={setActive} data={data} />}

      <main className="stage">
        <MapView data={data} grid={grid} layers={layers} basemap={basemap} camera={camera} focusZona={focusZona} onHover={setHover} onMap={onMap} onBuildings={setNBuild} />

        <div className="toolbar" role="toolbar" aria-label="Herramientas del mapa">
          <button className={panel ? "is-on" : ""} onClick={() => setPanel((p) => !p)} title="Panel de capas">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 3 2 8l10 5 10-5-10-5Z M2 13l10 5 10-5 M2 17.5l10 5 10-5" />
            </svg>
            <span>Capas</span>
          </button>
          <button className={is3d ? "is-on" : ""} onClick={toggle3d} title="Alternar vista 2D / 3D">
            <b>{is3d ? "3D" : "2D"}</b>
            <span>Vista</span>
          </button>
          <button className={layers.relieve ? "is-on" : ""} onClick={() => patch({ relieve: !layers.relieve })} title="Relieve del terreno">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="m2 20 7-12 4 6 3-4 6 10H2Z" />
            </svg>
            <span>Relieve</span>
          </button>
          <button onClick={switchTheme} title="Tema claro / oscuro">
            <svg viewBox="0 0 24 24" aria-hidden>
              {theme === "dark" ? <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" /> : <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />}
            </svg>
            <span>{theme === "dark" ? "Oscuro" : "Claro"}</span>
          </button>
        </div>

        {panel && <LayerPanel layers={layers} set={patch} basemap={basemap} setBasemap={setBasemap} data={data} onZona={goZona} onClose={() => setPanel(false)} />}

        <div className="readout" aria-live="polite">
          {hoverInfo ? (
            <>
              <i style={{ background: hoverInfo.color }} />
              <b>{fmt(hoverInfo.t)} °C</b>
              <span>{hoverInfo.clase}</span>
              <small>{signed(hoverInfo.t - data.meta.t_media)} vs media</small>
            </>
          ) : (
            <span className="readout-idle">Pasa el cursor sobre el mapa para leer la temperatura</span>
          )}
        </div>

        <Legend layers={layers} data={data} hoverT={hoverInfo?.t ?? null} />

        {layers.edificios && layers.edificiosColor === "temperatura" && (
          <div className="bnote">{nBuild > 0 ? `${nBuild.toLocaleString("es-MX")} edificios coloreados por LST` : "Acerca el mapa (zoom ≥ 13.5) para colorear edificios"}</div>
        )}
        <div className="basenote">{bm.hint}</div>
      </main>
    </div>
  );
}
