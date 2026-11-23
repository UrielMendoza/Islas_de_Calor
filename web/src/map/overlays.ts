import type { CanvasSource, GeoJSONSource, Map as MlMap, LayerSpecification, FilterSpecification } from "maplibre-gl";
import type { AppData, LayerState } from "../types";
import type { LstGrid } from "./lstGrid";
import { DEM_TILES, OFM_TILEJSON } from "./basemaps";
import { lstColorExpr, utfviColorExpr } from "./palette";

export const ZONA_TINTE: Record<string, string> = {
  Norte: "#a7dcd4",
  Centro: "#7fc4c0",
  Poniente: "#55a9a8",
  Oriente: "#2f8a8c",
  Sur: "#1d6a72",
};

const FONT = ["Noto Sans Regular"];
const FONT_B = ["Noto Sans Bold"];
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function labelPoints(fc: AppData["alcaldias"]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fc.features.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [f.properties.lx, f.properties.ly] },
      properties: f.properties,
    })),
  };
}


/** Añade fuentes y capas propias. Se llama en cada carga de estilo (al cambiar mapa base). */
export function installOverlays(map: MlMap, d: AppData, grid: LstGrid, darkBase: boolean) {
  const style = map.getStyle();
  // capas propias por encima de calles y por debajo de las etiquetas de calles y lugares
  const LABELS = ["transportation_name", "place", "poi", "housenumber", "mountain_peak", "aerodrome_label"];
  const firstSymbol = style.layers.find((l) => l.type === "symbol" && LABELS.includes((l as any)["source-layer"]))?.id;
  const ink = darkBase ? "#f3eee6" : "#16181c";
  const halo = darkBase ? "rgba(10,12,15,0.85)" : "rgba(255,255,255,0.9)";

  const src = (id: string, spec: any) => !map.getSource(id) && map.addSource(id, spec);
  src("ofm", { type: "vector", url: OFM_TILEJSON });
  src("dem", { type: "raster-dem", tiles: [DEM_TILES], tileSize: 256, encoding: "terrarium", maxzoom: 14 });
  src("dem-hs", { type: "raster-dem", tiles: [DEM_TILES], tileSize: 256, encoding: "terrarium", maxzoom: 14 });
  src("lst-src", { type: "canvas", canvas: grid.canvas, coordinates: grid.coordinates, animate: false });
  src("alc", { type: "geojson", data: d.alcaldias });
  src("alc-pt", { type: "geojson", data: labelPoints(d.alcaldias) });
  src("per", { type: "geojson", data: d.periferia });
  src("per-pt", { type: "geojson", data: labelPoints(d.periferia) });
  src("sc", { type: "geojson", data: d.conservacion });
  src("trans", { type: "geojson", data: d.transicion });
  src("malla", { type: "geojson", data: d.malla });
  src("zonas", { type: "geojson", data: d.zonas });
  src("zonas-pt", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: d.zonas.features.map((f) => ({ type: "Feature", geometry: { type: "Point", coordinates: [f.properties.lon, f.properties.lat] }, properties: f.properties })),
    },
  });
  src("bld-term", { type: "geojson", data: EMPTY });

  const add = (layer: LayerSpecification, top = false) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer, top ? undefined : firstSymbol);
  };

  add({ id: "hillshade", type: "hillshade", source: "dem-hs", layout: { visibility: "none" }, paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": darkBase ? "#000" : "#5b5346" } });
  add({
    id: "verde",
    type: "fill",
    source: "ofm",
    "source-layer": "park",
    layout: { visibility: "none" },
    paint: { "fill-color": "#3f9a5a", "fill-opacity": 0.35, "fill-outline-color": "#62c27d" },
  });
  add({
    id: "verde-bosque",
    type: "fill",
    source: "ofm",
    "source-layer": "landcover",
    filter: ["in", ["get", "class"], ["literal", ["wood", "grass", "wetland"]]] as FilterSpecification,
    layout: { visibility: "none" },
    paint: { "fill-color": "#3f9a5a", "fill-opacity": 0.28 },
  });
  add({ id: "sc-fill", type: "fill", source: "sc", paint: { "fill-color": "#2f7d4f", "fill-opacity": darkBase ? 0.22 : 0.16 } });
  add({ id: "lst", type: "raster", source: "lst-src", paint: { "raster-opacity": 0.85, "raster-resampling": "nearest", "raster-fade-duration": 0 } });
  add({
    id: "alc-tinte",
    type: "fill",
    source: "alc",
    layout: { visibility: "none" },
    paint: { "fill-color": ["match", ["get", "zona"], ...Object.entries(ZONA_TINTE).flat(), "#888"] as any, "fill-opacity": 0.82 },
  });
  add({ id: "alc-hit", type: "fill", source: "alc", paint: { "fill-color": "#000", "fill-opacity": 0 } });
  add({ id: "per-hit", type: "fill", source: "per", paint: { "fill-color": "#000", "fill-opacity": 0 } });
  add({
    id: "trans-fill",
    type: "fill",
    source: "trans",
    paint: {
      "fill-color": ["match", ["get", "tipo"], "exterior", "#ffd166", "#9be7b0"] as any,
      "fill-opacity": 0.32,
    },
  });
  add({
    id: "trans-line",
    type: "line",
    source: "trans",
    paint: { "line-color": ["match", ["get", "tipo"], "exterior", "#ffc531", "#7fe0a0"] as any, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.2, 14, 2.4], "line-opacity": 0.95 },
  });
  add({ id: "sc-casing", type: "line", source: "sc", paint: { "line-color": darkBase ? "#06140b" : "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 4, 14, 7], "line-opacity": 0.8 } });
  add({ id: "sc-line", type: "line", source: "sc", paint: { "line-color": darkBase ? "#5be08f" : "#14894a", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2, 14, 4], "line-dasharray": [2.5, 1.2] } });
  add({ id: "per-line", type: "line", source: "per", paint: { "line-color": ink, "line-width": 0.8, "line-opacity": 0.45, "line-dasharray": [2, 2] } });
  add({ id: "alc-line", type: "line", source: "alc", paint: { "line-color": ink, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 14, 2], "line-opacity": 0.75 } });
  add({ id: "zonas-fill", type: "fill", source: "zonas", paint: { "fill-color": "#ffffff", "fill-opacity": 0 } });
  add({
    id: "zonas-line",
    type: "line",
    source: "zonas",
    paint: {
      "line-color": ink,
      "line-width": 1.6,
      "line-dasharray": [1, 1.6],
      "line-opacity": 0.9,
    },
  });
  add({
    id: "malla-3d",
    type: "fill-extrusion",
    source: "malla",
    layout: { visibility: "none" },
    paint: {
      "fill-extrusion-color": "#888",
      "fill-extrusion-height": ["*", ["max", 0, ["-", ["get", "t"], 20]], 110],
      "fill-extrusion-opacity": 0.92,
      "fill-extrusion-vertical-gradient": true,
    },
  });
  add({
    id: "bld-base",
    type: "fill-extrusion",
    source: "ofm",
    "source-layer": "building",
    minzoom: 13,
    layout: { visibility: "none" },
    paint: {
      "fill-extrusion-color": darkBase ? "#3a3f48" : "#d9d4ca",
      "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      "fill-extrusion-opacity": 0.9,
    },
  });
  add({
    id: "bld-term",
    type: "fill-extrusion",
    source: "bld-term",
    layout: { visibility: "none" },
    paint: {
      "fill-extrusion-color": "#888",
      "fill-extrusion-height": ["get", "h"],
      "fill-extrusion-base": ["get", "mh"],
      "fill-extrusion-opacity": 0.95,
    },
  });

  // etiquetas: siempre encima
  add(
    {
      id: "alc-label",
      type: "symbol",
      source: "alc-pt",
      layout: { "text-field": ["get", "nombre"], "text-font": FONT_B, "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10, 13, 14], "text-max-width": 8, "text-letter-spacing": 0.04 },
      paint: { "text-color": ink, "text-halo-color": halo, "text-halo-width": 1.6 },
    },
    true,
  );
  add(
    {
      id: "per-label",
      type: "symbol",
      source: "per-pt",
      layout: { "text-field": ["get", "nombre"], "text-font": FONT, "text-size": 10.5, "text-max-width": 8 },
      paint: { "text-color": ink, "text-opacity": 0.75, "text-halo-color": halo, "text-halo-width": 1.4 },
    },
    true,
  );
  add(
    {
      id: "zonas-label",
      type: "symbol",
      source: "zonas-pt",
      layout: {
        "text-field": ["upcase", ["get", "nombre"]],
        "text-font": FONT_B,
        "text-size": 11,
        "text-letter-spacing": 0.12,
        "text-max-width": 12,
        "symbol-placement": "point",
      },
      paint: { "text-color": ink, "text-halo-color": halo, "text-halo-width": 2 },
    },
    true,
  );
}

const vis = (map: MlMap, id: string, on: boolean) => {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
};

/** Aplica el estado de capas al mapa. */
export function syncLayers(map: MlMap, s: LayerState, d: AppData, focusZona: string | null) {
  const colorBy = s.thermal === "utfvi" ? utfviColorExpr(["get", "t"], d.meta.umbrales_c) : lstColorExpr(["get", "t"]);

  vis(map, "lst", s.thermal !== "none");
  if (map.getLayer("lst")) map.setPaintProperty("lst", "raster-opacity", s.opacity);

  vis(map, "malla-3d", s.malla);
  if (map.getLayer("malla-3d")) map.setPaintProperty("malla-3d", "fill-extrusion-color", colorBy as any);

  vis(map, "alc-line", s.alcaldias);
  vis(map, "alc-label", s.alcaldias);
  vis(map, "alc-tinte", s.zonasTinte);
  vis(map, "per-line", s.periferia);
  vis(map, "per-label", s.periferia);
  vis(map, "sc-fill", s.sc);
  vis(map, "sc-line", s.sc);
  vis(map, "sc-casing", s.sc);
  vis(map, "trans-fill", s.transicion);
  vis(map, "trans-line", s.transicion);
  vis(map, "zonas-line", s.zonas);
  vis(map, "zonas-label", s.zonas);
  vis(map, "verde", s.verde);
  vis(map, "verde-bosque", s.verde);
  vis(map, "hillshade", s.relieve);

  if (map.getLayer("zonas-line")) {
    map.setPaintProperty("zonas-line", "line-width", ["case", ["==", ["get", "id"], focusZona ?? ""], 3.2, 1.4]);
    map.setPaintProperty("zonas-line", "line-opacity", focusZona ? ["case", ["==", ["get", "id"], focusZona], 1, 0.35] : 0.9);
    map.setPaintProperty("zonas-label", "text-opacity", focusZona ? ["case", ["==", ["get", "id"], focusZona], 1, 0.45] : 1);
  }

  // edificios: la capa base siempre carga teselas; se vuelve invisible si se colorean por temperatura
  const termico = s.edificios && s.edificiosColor === "temperatura";
  vis(map, "bld-base", s.edificios);
  if (map.getLayer("bld-base")) map.setPaintProperty("bld-base", "fill-extrusion-opacity", termico ? 0 : 0.9);
  vis(map, "bld-term", termico);
  if (map.getLayer("bld-term")) map.setPaintProperty("bld-term", "fill-extrusion-color", ["case", ["==", ["get", "t"], -999], "#6b6f76", colorBy] as any);

  // ocultar edificios propios del mapa base cuando se muestran los 3D
  for (const l of map.getStyle().layers) {
    if ((l as any)["source-layer"] === "building" && (l as any).source !== "ofm") vis(map, l.id, !s.edificios);
  }

  const wantTerrain = s.relieve;
  const hasTerrain = !!map.getTerrain();
  if (wantTerrain && !hasTerrain) map.setTerrain({ source: "dem", exaggeration: 1.4 });
  if (!wantTerrain && hasTerrain) map.setTerrain(null);
}

/** Vuelve a subir el lienzo LST a la GPU tras repintarlo. */
export function refreshLst(map: MlMap) {
  if (!map.style) return;
  const src = map.getSource("lst-src") as CanvasSource | undefined;
  if (!src) return;
  src.play();
  map.once("render", () => src.pause());
  map.triggerRepaint();
}

/** Construye la capa de edificios coloreados con la LST del píxel que ocupan. */
export function updateThermalBuildings(map: MlMap, grid: LstGrid) {
  const target = map.getSource("bld-term") as GeoJSONSource | undefined;
  if (!target) return 0;
  if (map.getZoom() < 13.5) {
    target.setData(EMPTY);
    return 0;
  }
  const feats = map.querySourceFeatures("ofm", { sourceLayer: "building" });
  const seen = new Set<string>();
  const out: GeoJSON.Feature[] = [];
  for (const f of feats) {
    const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    const ring = g.type === "Polygon" ? g.coordinates[0] : g.type === "MultiPolygon" ? g.coordinates[0][0] : null;
    if (!ring || ring.length < 3) continue;
    let x = 0;
    let y = 0;
    const n = ring.length - 1;
    for (let i = 0; i < n; i++) {
      x += ring[i][0];
      y += ring[i][1];
    }
    x /= n;
    y /= n;
    const key = `${f.id ?? ""}:${x.toFixed(6)},${y.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = grid.valueAt(x, y);
    const p = f.properties as Record<string, number>;
    out.push({
      type: "Feature",
      geometry: g,
      properties: { t: t === null ? -999 : Math.round(t * 10) / 10, h: p.render_height ?? 6, mh: p.render_min_height ?? 0 },
    });
    if (out.length > 60000) break;
  }
  target.setData({ type: "FeatureCollection", features: out });
  return out.length;
}
