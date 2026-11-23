import type { StyleSpecification } from "maplibre-gl";

export const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const OFM_TILEJSON = "https://tiles.openfreemap.org/planet";
export const DEM_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

function rasterStyle(tiles: string, attribution: string, maxzoom = 19): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: { base: { type: "raster", tiles: [tiles], tileSize: 256, attribution, maxzoom } },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}

export interface Basemap {
  id: string;
  label: string;
  hint: string;
  dark: boolean;
  style: string | StyleSpecification;
}

export const BASEMAPS: Basemap[] = [
  { id: "dark", label: "Oscuro", hint: "OpenStreetMap · OpenFreeMap", dark: true, style: "https://tiles.openfreemap.org/styles/dark" },
  { id: "positron", label: "Claro", hint: "OpenStreetMap · OpenFreeMap", dark: false, style: "https://tiles.openfreemap.org/styles/positron" },
  { id: "liberty", label: "Calles", hint: "OpenStreetMap · OpenFreeMap", dark: false, style: "https://tiles.openfreemap.org/styles/liberty" },
  {
    id: "osm",
    label: "OSM estándar",
    hint: "Teselas openstreetmap.org",
    dark: false,
    style: rasterStyle("https://tile.openstreetmap.org/{z}/{x}/{y}.png", "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>"),
  },
  {
    id: "sat",
    label: "Satélite",
    hint: "Esri World Imagery",
    dark: true,
    style: rasterStyle(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      "Imágenes © Esri, Maxar, Earthstar Geographics",
    ),
  },
];
