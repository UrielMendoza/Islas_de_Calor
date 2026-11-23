// Paleta oficial del código de Earth Engine (UTFVI, 6 clases).
export const UTFVI_COLORS = ["#2b83ba", "#abdda4", "#fdae61", "#f46d43", "#d7191c", "#7f0000"] as const;
export const UTFVI_LABELS = ["Inexistente", "Normal", "Débil", "Moderado", "Fuerte", "Severo"] as const;
export const UTFVI_DESC = [
  "Más fresco que la media urbana",
  "Ligeramente sobre la media",
  "Calor perceptible",
  "Calor acumulado",
  "Isla de calor marcada",
  "Isla de calor extrema",
] as const;

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const STOPS = UTFVI_COLORS.map(hexToRgb);

/** Rampa continua construida con los mismos 6 colores (t en 0..1). */
export function ramp(t: number): RGB {
  const x = Math.min(1, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f].map(Math.round) as RGB;
}

export function rampHex(t: number): string {
  const [r, g, b] = ramp(t);
  return `rgb(${r},${g},${b})`;
}

/** Clase UTFVI (0..5) a partir de la temperatura en °C y umbrales en °C. */
export function utfviClass(t: number, thresholdsC: number[]): number {
  let c = 0;
  for (const th of thresholdsC) if (t >= th) c++;
  return c;
}

// ---- rampa continua por temperatura: paradas en cuantiles (meta.rampa)
let T_STOPS = [24, 29, 32, 34.5, 36.5, 39.5];
export function setRampStops(stops: number[]) {
  if (stops?.length === UTFVI_COLORS.length) T_STOPS = stops;
}
export const rampStops = () => T_STOPS;

/** Posición 0..1 de una temperatura en la rampa (lineal por tramos). */
export function tempPos(t: number): number {
  const s = T_STOPS;
  if (t <= s[0]) return 0;
  if (t >= s[s.length - 1]) return 1;
  let i = 0;
  while (t > s[i + 1]) i++;
  return (i + (t - s[i]) / (s[i + 1] - s[i])) / (s.length - 1);
}
export const tempRgb = (t: number): RGB => ramp(tempPos(t));
export const tempHex = (t: number): string => rampHex(tempPos(t));

/** Expresión MapLibre: color continuo por temperatura. */
export function lstColorExpr(prop: unknown): unknown[] {
  const stops: unknown[] = [];
  UTFVI_COLORS.forEach((c, i) => stops.push(T_STOPS[i], c));
  return ["interpolate", ["linear"], prop, ...stops];
}

/** Expresión MapLibre: color por clase UTFVI derivada de la temperatura. */
export function utfviColorExpr(prop: unknown, thresholdsC: number[]): unknown[] {
  const e: unknown[] = ["step", prop, UTFVI_COLORS[0]];
  thresholdsC.forEach((th, i) => e.push(th, UTFVI_COLORS[i + 1]));
  return e;
}
