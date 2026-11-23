import type { Meta, Thermal } from "../types";
import { tempRgb, UTFVI_COLORS, hexToRgb, utfviClass } from "./palette";

/**
 * Ráster LST cuantizado (PNG 8 bits). Se decodifica en el navegador para:
 *  - colorear al vuelo (LST continua o clases UTFVI, filtro por rango)
 *  - consultar el valor bajo el cursor
 *  - asignar temperatura a cada edificio 3D
 */
export class LstGrid {
  readonly canvas: HTMLCanvasElement;
  private constructor(
    readonly data: Uint8Array,
    readonly meta: Meta,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = meta.width;
    this.canvas.height = meta.height;
  }

  static async load(url: string, meta: Meta): Promise<LstGrid> {
    const blob = await fetch(url).then((r) => r.blob());
    const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0);
    const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
    const data = new Uint8Array(c.width * c.height);
    for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4];
    return new LstGrid(data, meta);
  }

  get coordinates(): [[number, number], [number, number], [number, number], [number, number]] {
    const [l, b, r, t] = this.meta.bounds;
    return [
      [l, t],
      [r, t],
      [r, b],
      [l, b],
    ];
  }

  /** Temperatura (°C) en lon/lat, o null si no hay dato. */
  valueAt(lng: number, lat: number): number | null {
    const [l, b, r, t] = this.meta.bounds;
    if (lng < l || lng >= r || lat <= b || lat > t) return null;
    const col = Math.floor(((lng - l) / (r - l)) * this.meta.width);
    const row = Math.floor(((t - lat) / (t - b)) * this.meta.height);
    const v = this.data[row * this.meta.width + col];
    return v === 0 ? null : this.meta.offset + (v - 1) * this.meta.scale;
  }

  /** Pinta el lienzo según el modo y el rango visible (°C). */
  render(mode: Thermal, range: [number, number]) {
    const lut = new Uint32Array(256);
    const little = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
    const pack = (r: number, g: number, b: number, a: number) =>
      little ? ((a << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    const classRgb = UTFVI_COLORS.map(hexToRgb);
    for (let v = 1; v < 256; v++) {
      const t = this.meta.offset + (v - 1) * this.meta.scale;
      if (t < range[0] || t > range[1]) continue;
      const rgb = mode === "utfvi" ? classRgb[utfviClass(t, this.meta.umbrales_c)] : tempRgb(t);
      lut[v] = pack(rgb[0], rgb[1], rgb[2], 255);
    }
    const ctx = this.canvas.getContext("2d")!;
    const img = ctx.createImageData(this.meta.width, this.meta.height);
    const out = new Uint32Array(img.data.buffer);
    const d = this.data;
    for (let i = 0; i < d.length; i++) out[i] = lut[d[i]];
    ctx.putImageData(img, 0, 0);
  }
}
