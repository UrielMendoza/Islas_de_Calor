import { useEffect, useRef } from "react";
import maplibregl, { type Map as MlMap, type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AppData, Camera, LayerState } from "../types";
import type { LstGrid } from "../map/lstGrid";
import { BASEMAPS } from "../map/basemaps";
import { installOverlays, refreshLst, syncLayers, updateThermalBuildings } from "../map/overlays";
import { UTFVI_COLORS, UTFVI_LABELS, utfviClass } from "../map/palette";
import { fmt, signed } from "./charts";

export interface Hover {
  t: number | null;
  x: number;
  y: number;
  lng: number;
  lat: number;
}

interface Props {
  data: AppData;
  grid: LstGrid;
  layers: LayerState;
  basemap: string;
  camera: { cam: Camera; key: number } | null;
  focusZona: string | null;
  onHover: (h: Hover | null) => void;
  onMap: (m: MlMap) => void;
  onBuildings: (n: number) => void;
}

function popupHtml(f: MapGeoJSONFeature) {
  const p = f.properties as Record<string, any>;
  const clases: number[] = typeof p.clases === "string" ? JSON.parse(p.clases) : p.clases ?? [];
  const bar = clases.map((c, i) => (c > 0 ? `<span style="width:${c}%;background:${UTFVI_COLORS[i]}"></span>` : "")).join("");
  const dif = Number(p.s_dif);
  return `
    <div class="pop">
      <div class="pop-kicker">${p.zona ? (p.zona === "Periferia" ? "Periferia · Edomex" : `Zona ${p.zona}`) : p.tipo ? "Zona de interés" : ""}</div>
      <div class="pop-title">${p.nombre}</div>
      <div class="pop-temp">${fmt(Number(p.s_media))}<small>°C</small>
        <em class="${dif > 0.3 ? "is-hot" : dif < -0.3 ? "is-cool" : ""}">${signed(dif)} vs media</em></div>
      <div class="pop-bar">${bar}</div>
      <div class="pop-facts"><span>P90 <b>${fmt(Number(p.s_p90))}°</b></span><span>Fuerte+severo <b>${fmt(Number(p.s_pct_fuerte_severo))}%</b></span><span><b>${fmt(Number(p.s_km2), 0)}</b> km²</span></div>
    </div>`;
}

export function MapView({ data, grid, layers, basemap, camera, focusZona, onHover, onMap, onBuildings }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const st = useRef({ layers, basemap, focusZona });
  st.current = { layers, basemap, focusZona };
  const lastRender = useRef("");
  const ready = useRef(false);

  const paintGrid = (force = false) => {
    const l = st.current.layers;
    if (l.thermal === "none") return;
    const key = `${l.thermal}|${l.range.join(",")}`;
    if (!force && key === lastRender.current) return;
    lastRender.current = key;
    grid.render(l.thermal, l.range);
    if (map.current && ready.current) refreshLst(map.current);
  };

  // inicialización
  useEffect(() => {
    const bm = BASEMAPS.find((b) => b.id === basemap) ?? BASEMAPS[0];
    paintGrid(true);
    const m = new maplibregl.Map({
      container: el.current!,
      style: bm.style,
      center: [-99.13, 19.44],
      zoom: 9.6,
      maxPitch: 78,
      attributionControl: { compact: true, customAttribution: "LST Landsat 2022 (SMW) · Límites: SEDEMA/CDMX, INEGI" },
      hash: false,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    m.on("style.load", () => {
      const dark = (BASEMAPS.find((b) => b.id === st.current.basemap) ?? BASEMAPS[0]).dark;
      installOverlays(m, data, grid, dark);
      ready.current = true;
      syncLayers(m, st.current.layers, data, st.current.focusZona);
    });

    // valor bajo el cursor
    let raf = 0;
    m.on("mousemove", (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const t = grid.valueAt(e.lngLat.lng, e.lngLat.lat);
        onHover({ t, x: e.point.x, y: e.point.y, lng: e.lngLat.lng, lat: e.lngLat.lat });
      });
    });
    m.getCanvas().addEventListener("mouseleave", () => onHover(null));

    // fichas al hacer clic
    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "280px", className: "popup" });
    m.on("click", (e) => {
      const ids = ["zonas-fill", "alc-hit", "per-hit"].filter((id) => m.getLayer(id) && m.getLayoutProperty(id, "visibility") !== "none");
      const f = m.queryRenderedFeatures(e.point, { layers: ids })[0];
      if (!f) return;
      popup.setLngLat(e.lngLat).setHTML(popupHtml(f)).addTo(m);
    });
    for (const id of ["zonas-fill", "alc-hit", "per-hit"]) {
      m.on("mouseenter", id, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", id, () => (m.getCanvas().style.cursor = ""));
    }

    // edificios por temperatura: se recalculan al terminar cada movimiento
    let t: number | undefined;
    const rebuild = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const l = st.current.layers;
        if (l.edificios && l.edificiosColor === "temperatura") onBuildings(updateThermalBuildings(m, grid));
      }, 220);
    };
    m.on("moveend", rebuild);
    m.on("sourcedata", (e) => {
      if (e.sourceId === "ofm" && e.isSourceLoaded) rebuild();
    });

    onMap(m);
    return () => {
      // en desarrollo React monta dos veces: no dejar referencias al mapa destruido
      ready.current = false;
      map.current = null;
      m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cambio de mapa base
  const firstBase = useRef(true);
  useEffect(() => {
    if (firstBase.current) {
      firstBase.current = false;
      return;
    }
    const bm = BASEMAPS.find((b) => b.id === basemap) ?? BASEMAPS[0];
    ready.current = false;
    map.current?.setStyle(bm.style, { diff: false });
  }, [basemap]);

  // estado de capas
  useEffect(() => {
    const m = map.current;
    paintGrid();
    if (!m || !ready.current) return;
    syncLayers(m, layers, data, focusZona);
    if (layers.edificios && layers.edificiosColor === "temperatura") onBuildings(updateThermalBuildings(m, grid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, focusZona]);

  // cámara del recorrido
  useEffect(() => {
    if (!camera || !map.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.current.flyTo({ ...camera.cam, duration: reduce ? 0 : 2800, curve: 1.3, essential: true });
  }, [camera]);

  return <div ref={el} className="map" />;
}

/** Texto corto para el lector térmico. */
export function describeT(t: number, umbrales: number[]) {
  const c = utfviClass(t, umbrales);
  return { clase: UTFVI_LABELS[c], color: UTFVI_COLORS[c] };
}
