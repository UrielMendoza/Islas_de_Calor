export interface Stats {
  n: number;
  km2: number;
  media: number;
  mediana: number;
  p10: number;
  p90: number;
  max: number;
  min: number;
  dif: number;
  clases: number[];
  pct_fuerte_severo: number;
}

export interface Meta {
  fuente: string;
  bounds: [number, number, number, number];
  width: number;
  height: number;
  scale: number;
  offset: number;
  resolucion_m: number;
  t_media: number;
  t_min: number;
  t_max: number;
  p2: number;
  p98: number;
  rampa: number[];
  umbrales_utfvi: number[];
  umbrales_c: number[];
  clases: string[];
  paleta_utfvi: string[];
  total: Stats;
  zonas: Record<string, Stats>;
  gradiente: Record<"dentro_sc" | "borde_0_1km" | "km_1_3" | "nucleo_mas_3km", Stats>;
  perfil: { d: number; media: number; p25: number; p75: number; n: number }[];
  histograma: { bins: number[]; n: number[] };
}

export type Thermal = "lst" | "utfvi" | "none";
export type BuildingColor = "neutro" | "temperatura";

export interface LayerState {
  thermal: Thermal;
  opacity: number;
  range: [number, number];
  malla: boolean;
  edificios: boolean;
  edificiosColor: BuildingColor;
  alcaldias: boolean;
  zonasTinte: boolean;
  periferia: boolean;
  sc: boolean;
  transicion: boolean;
  zonas: boolean;
  verde: boolean;
  relieve: boolean;
}

export interface Camera {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export type GeoFC = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, any>>;

export interface AppData {
  meta: Meta;
  alcaldias: GeoFC;
  periferia: GeoFC;
  conservacion: GeoFC;
  transicion: GeoFC;
  malla: GeoFC;
  zonas: GeoFC;
}
