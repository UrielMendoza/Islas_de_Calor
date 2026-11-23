"""
Prepara los insumos del geoportal "Islas de Calor · ZMVM".

Entrada
  data/LST_SMW_2022_urb.tif          LST (°C) Landsat, método SMW, 2022, máscara urbana
  data/vector/*.geojson               límites (se descargan si no existen)

Salida (web/public/data/)
  lst_grid.png        LST cuantizada a 8 bits (0 = sin dato; T = OFFSET + (v-1)*SCALE)
  meta.json           georreferencia, cuantización, estadísticas y perfiles
  alcaldias.geojson   16 alcaldías con zona (norte/centro/poniente/oriente/sur) y estadísticas
  periferia.geojson   municipios del Edomex cubiertos por el ráster, con estadísticas
  conservacion.geojson  Suelo de Conservación CDMX (límite urbano–natural oficial)
  transicion.geojson  franja de transición (±1 km del límite del Suelo de Conservación)
  malla500.geojson    malla regular de 500 m con LST media y clase UTFVI
  zonas.geojson       zonas de interés del recorrido, con estadísticas

UTFVI (Urban Thermal Field Variance Index), igual que el código de Earth Engine:
  UTFVI = (LST_K - T_media_K) / T_media_K
  clases: <0 | 0–0.005 | 0.005–0.010 | 0.010–0.015 | 0.015–0.020 | >=0.020

Uso:  python scripts/prepare_data.py
"""

from __future__ import annotations

import io
import json
import shutil
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
import requests
from PIL import Image
from pyproj import Transformer
from rasterio.features import rasterize, shapes
from scipy.ndimage import distance_transform_edt
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
RASTER = ROOT / "data" / "LST_SMW_2022_urb.tif"
VEC = ROOT / "data" / "vector"
OUT = ROOT / "web" / "public" / "data"

SCALE = 0.15  # °C por nivel
OFFSET = 10.0  # °C del nivel 1
UTM = "EPSG:32614"

URLS = {
    "alcaldias": "https://datos.cdmx.gob.mx/dataset/bae265a8-d1f6-4614-b399-4184bc93e027/resource/deb5c583-84e2-4e07-a706-1b3a0dbc99b0/download/limite-de-las-alcaldas.json",
    "conservacion": "https://datos.cdmx.gob.mx/dataset/2a39f1a5-21ec-4c98-a8d8-32168b0fa05f/resource/f86ab0d8-f64c-4dae-9c21-957b0f978e0d/download/f86ab0d8-f64c-4dae-9c21-957b0f978e0d.zip",
    "edomex": "https://raw.githubusercontent.com/PhantomInsights/mexico-geojson/main/2022/states/M%C3%A9xico.json",
}

# Agrupación preliminar de alcaldías (infografía 1 de la propuesta). Revisar con autores.
ZONA_ALCALDIA = {
    "Azcapotzalco": "Norte",
    "Gustavo A. Madero": "Norte",
    "Cuauhtémoc": "Centro",
    "Benito Juárez": "Centro",
    "Miguel Hidalgo": "Centro",
    "Venustiano Carranza": "Centro",
    "Iztacalco": "Centro",
    "Álvaro Obregón": "Poniente",
    "Cuajimalpa de Morelos": "Poniente",
    "La Magdalena Contreras": "Poniente",
    "Iztapalapa": "Oriente",
    "Tláhuac": "Oriente",
    "Coyoacán": "Sur",
    "Tlalpan": "Sur",
    "Xochimilco": "Sur",
    "Milpa Alta": "Sur",
}

# Zonas de interés del recorrido (DATOS DE PRUEBA: centro + radio). Reemplazar por polígonos de los autores.
ZONAS = [
    dict(id="guadalupe", nombre="Sierra de Guadalupe · Cuautepec", tipo="transicion", lon=-99.140, lat=19.552, r=2000),
    dict(id="poniente", nombre="Barrancas del poniente · Santa Fe", tipo="transicion", lon=-99.262, lat=19.362, r=2000),
    dict(id="ajusco", nombre="Ajusco medio · Tlalpan", tipo="transicion", lon=-99.205, lat=19.262, r=2000),
    dict(id="xochimilco", nombre="Xochimilco · borde chinampero", tipo="transicion", lon=-99.105, lat=19.262, r=2000),
    dict(id="catarina", nombre="Sierra de Santa Catarina", tipo="transicion", lon=-99.025, lat=19.322, r=2000),
    dict(id="chapultepec", nombre="Bosque de Chapultepec", tipo="contraste", lon=-99.193, lat=19.418, r=1600),
    dict(id="aeropuerto", nombre="Aeropuerto · ex vaso de Texcoco", tipo="contraste", lon=-99.075, lat=19.436, r=2000),
    dict(id="neza", nombre="Nezahualcóyotl", tipo="periferia", lon=-99.015, lat=19.400, r=2200),
    dict(id="ecatepec", nombre="Ecatepec", tipo="periferia", lon=-99.050, lat=19.600, r=2200),
]

CLASES = ["Inexistente", "Normal", "Débil", "Moderado", "Fuerte", "Severo"]
UMBRALES = [0.0, 0.005, 0.010, 0.015, 0.020]


# ---------------------------------------------------------------- descargas
def ensure_vectors() -> None:
    VEC.mkdir(parents=True, exist_ok=True)
    if not (VEC / "alcaldias_cdmx.geojson").exists():
        r = requests.get(URLS["alcaldias"], timeout=120)
        r.raise_for_status()
        (VEC / "alcaldias_cdmx.geojson").write_bytes(r.content)
    if not (VEC / "suelo_conservacion_cdmx.geojson").exists():
        r = requests.get(URLS["conservacion"], timeout=120)
        r.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            shp = [n for n in z.namelist() if n.endswith(".shp")][0]
            tmp = VEC / "_sc"
            z.extractall(tmp)
        g = gpd.read_file(tmp / shp).to_crs(4326)
        shutil.rmtree(tmp, ignore_errors=True)
        g[["id", "geometry"]].to_file(VEC / "suelo_conservacion_cdmx.geojson", driver="GeoJSON")
    if not (VEC / "municipios_edomex_zmvm.geojson").exists():
        r = requests.get(URLS["edomex"], timeout=300)
        r.raise_for_status()
        g = gpd.read_file(io.BytesIO(r.content))
        with rasterio.open(RASTER) as s:
            bb = box(*s.bounds)
        g = g[g.intersects(bb)][["CVEGEO", "NOMGEO", "geometry"]]
        g.to_file(VEC / "municipios_edomex_zmvm.geojson", driver="GeoJSON")


# ---------------------------------------------------------------- utilidades
def r1(x):
    return None if x is None or not np.isfinite(x) else round(float(x), 1)


def round_coords(geom, nd=5):
    def rc(c):
        if isinstance(c[0], (list, tuple)):
            return [rc(x) for x in c]
        return [round(c[0], nd), round(c[1], nd)]

    m = mapping(geom)
    return {"type": m["type"], "coordinates": rc(m["coordinates"])}


def write_fc(path: Path, feats):
    fc = {"type": "FeatureCollection", "features": feats}
    path.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  {path.name:24s} {path.stat().st_size/1024:8.0f} KB  ({len(feats)} elementos)")


def main() -> None:
    ensure_vectors()
    OUT.mkdir(parents=True, exist_ok=True)

    with rasterio.open(RASTER) as src:
        lst = src.read(1).astype("float64")
        tr = src.transform
        H, W = lst.shape
        bounds = src.bounds

    valid = np.isfinite(lst)
    v = lst[valid]
    tmean_c = float(v.mean())
    tmean_k = tmean_c + 273.15
    utfvi = (lst + 273.15 - tmean_k) / tmean_k
    cls = np.zeros(lst.shape, dtype="uint8")
    cls[valid] = 1 + np.digitize(utfvi[valid], UMBRALES)  # 1..6
    # umbrales equivalentes en °C (útiles para la leyenda y el cliente)
    umbrales_c = [round(tmean_k * (1 + u) - 273.15, 2) for u in UMBRALES]
    print(f"T media = {tmean_c:.2f} °C ; umbrales UTFVI en °C: {umbrales_c}")

    # ---------- ráster cuantizado (PNG escala de grises, sin pérdida)
    q = np.zeros(lst.shape, dtype="uint8")
    q[valid] = np.clip(np.round((lst[valid] - OFFSET) / SCALE) + 1, 1, 255).astype("uint8")
    Image.fromarray(q, "L").save(OUT / "lst_grid.png", optimize=True)
    print(f"  lst_grid.png  {(OUT/'lst_grid.png').stat().st_size/1024:.0f} KB")

    # ---------- vectores base
    alc = gpd.read_file(VEC / "alcaldias_cdmx.geojson").to_crs(4326)
    alc["zona"] = alc["NOMGEO"].map(ZONA_ALCALDIA)
    sc = gpd.read_file(VEC / "suelo_conservacion_cdmx.geojson").to_crs(4326)
    mun = gpd.read_file(VEC / "municipios_edomex_zmvm.geojson").to_crs(4326)

    # ---------- distancia con signo al límite del Suelo de Conservación (m)
    sc_mask = rasterize(((g, 1) for g in sc.geometry), out_shape=lst.shape, transform=tr, fill=0, dtype="uint8").astype(bool)
    lat_c = (bounds.top + bounds.bottom) / 2
    px_y = abs(tr.e) * 111_320
    px_x = tr.a * 111_320 * np.cos(np.radians(lat_c))
    d_out = distance_transform_edt(~sc_mask, sampling=(px_y, px_x))  # fuera del SC
    d_in = distance_transform_edt(sc_mask, sampling=(px_y, px_x))  # dentro del SC
    dist = np.where(sc_mask, -d_in, d_out)  # + = lado urbano, - = dentro del SC

    # ---------- pertenencia: alcaldía / municipio
    unit_id = np.zeros(lst.shape, dtype="int16")
    units = []
    for _, r in alc.iterrows():
        units.append(dict(nombre=r["NOMGEO"], ent="CDMX", zona=r["zona"]))
    for _, r in mun.iterrows():
        units.append(dict(nombre=r["NOMGEO"], ent="Edomex", zona="Periferia"))
    geoms = list(alc.geometry) + list(mun.geometry)
    unit_id = rasterize(((g, i + 1) for i, g in enumerate(geoms)), out_shape=lst.shape, transform=tr, fill=0, dtype="int16")

    def stats(mask: np.ndarray) -> dict | None:
        m = mask & valid
        n = int(m.sum())
        if n < 20:
            return None
        t = lst[m]
        c = cls[m]
        pct = [round(100 * float((c == k).sum()) / n, 1) for k in range(1, 7)]
        return dict(
            n=n,
            km2=round(n * px_x * px_y / 1e6, 1),
            media=r1(t.mean()),
            mediana=r1(np.median(t)),
            p10=r1(np.percentile(t, 10)),
            p90=r1(np.percentile(t, 90)),
            max=r1(t.max()),
            min=r1(t.min()),
            dif=r1(t.mean() - tmean_c),
            clases=pct,
            pct_fuerte_severo=round(pct[4] + pct[5], 1),
        )

    # ---------- alcaldías
    feats = []
    for i, r in alc.iterrows():
        s = stats(unit_id == (i + 1)) or {}
        g = r.geometry.simplify(0.0003, preserve_topology=True)
        feats.append(dict(type="Feature", geometry=round_coords(g), properties=dict(nombre=r["NOMGEO"], cve=r["CVEGEO"], zona=r["zona"], lx=round(r.geometry.representative_point().x, 5), ly=round(r.geometry.representative_point().y, 5), **{f"s_{k}": v for k, v in s.items() if k != "clases"}, clases=s.get("clases"))))
    write_fc(OUT / "alcaldias.geojson", feats)

    # ---------- periferia (Edomex) con cobertura del ráster
    feats = []
    for j, r in mun.iterrows():
        s = stats(unit_id == (len(alc) + j + 1))
        if not s or s["km2"] < 3:
            continue
        g = r.geometry.simplify(0.0004, preserve_topology=True)
        feats.append(dict(type="Feature", geometry=round_coords(g), properties=dict(nombre=r["NOMGEO"], cve=r["CVEGEO"], zona="Periferia", lx=round(r.geometry.representative_point().x, 5), ly=round(r.geometry.representative_point().y, 5), **{f"s_{k}": v for k, v in s.items() if k != "clases"}, clases=s["clases"])))
    write_fc(OUT / "periferia.geojson", feats)

    # ---------- suelo de conservación (recortado a la vista regional)
    region = box(bounds.left - 0.05, bounds.bottom - 0.2, bounds.right + 0.05, bounds.top + 0.05)
    sc_u = unary_union(sc.geometry).intersection(region).simplify(0.0003, preserve_topology=True)
    write_fc(OUT / "conservacion.geojson", [dict(type="Feature", geometry=round_coords(sc_u), properties=dict(nombre="Suelo de Conservación (CDMX)"))])

    # ---------- franja de transición: ±1 km del límite, sólo donde hay dato urbano
    footprint = unary_union([shape(g) for g, val in shapes(valid.astype("uint8"), mask=valid, transform=tr) if val == 1])
    sc_utm = gpd.GeoSeries([unary_union(sc.geometry)], crs=4326).to_crs(UTM)
    fp_utm = gpd.GeoSeries([footprint], crs=4326).to_crs(UTM).buffer(60).buffer(-60)
    lim = sc_utm.boundary
    band_ext = lim.buffer(1000).difference(sc_utm).intersection(fp_utm)  # lado urbano
    band_int = lim.buffer(1000).intersection(sc_utm).intersection(fp_utm)  # urbanización dentro del SC
    feats = []
    for nombre, tipo, geom in [("Borde urbano (0–1 km fuera del SC)", "exterior", band_ext), ("Urbanización dentro del Suelo de Conservación", "interior", band_int)]:
        g = geom.to_crs(4326).iloc[0].simplify(0.0002, preserve_topology=True)
        m = (dist >= 0) & (dist <= 1000) if tipo == "exterior" else (dist < 0) & (dist >= -1000)
        s = stats(m)
        feats.append(dict(type="Feature", geometry=round_coords(g), properties=dict(nombre=nombre, tipo=tipo, **{f"s_{k}": v for k, v in s.items() if k != "clases"}, clases=s["clases"])))
    write_fc(OUT / "transicion.geojson", feats)

    # ---------- malla de 500 m (UTM 14N)
    to_utm = Transformer.from_crs(4326, UTM, always_xy=True)
    to_geo = Transformer.from_crs(UTM, 4326, always_xy=True)
    rows, cols = np.nonzero(valid)
    lon = tr.c + (cols + 0.5) * tr.a
    lat = tr.f + (rows + 0.5) * tr.e
    x, y = to_utm.transform(lon, lat)
    CELL = 500
    x0, y0 = np.floor(x.min() / CELL) * CELL, np.floor(y.min() / CELL) * CELL
    ci = ((x - x0) // CELL).astype(int)
    cj = ((y - y0) // CELL).astype(int)
    nx = ci.max() + 1
    key = cj * nx + ci
    tv = lst[rows, cols]
    cnt = np.bincount(key)
    sm = np.bincount(key, weights=tv)
    sev = np.bincount(key, weights=(cls[rows, cols] >= 5).astype(float))
    dsum = np.bincount(key, weights=dist[rows, cols])
    feats = []
    full = (CELL / px_x) * (CELL / px_y)
    for k in np.nonzero(cnt >= 0.25 * full)[0]:
        i, j = k % nx, k // nx
        xs = [x0 + i * CELL, x0 + (i + 1) * CELL]
        ys = [y0 + j * CELL, y0 + (j + 1) * CELL]
        lo, la = to_geo.transform([xs[0], xs[1], xs[1], xs[0], xs[0]], [ys[0], ys[0], ys[1], ys[1], ys[0]])
        t = sm[k] / cnt[k]
        u = (t + 273.15 - tmean_k) / tmean_k
        c = int(1 + np.digitize([u], UMBRALES)[0])
        d = dsum[k] / cnt[k]
        zona = "transicion" if abs(d) <= 1000 else ("sc" if d < 0 else "urbano")
        feats.append(
            dict(
                type="Feature",
                geometry={"type": "Polygon", "coordinates": [[[round(a, 5), round(b, 5)] for a, b in zip(lo, la)]]},
                properties=dict(t=round(t, 1), c=c, sev=round(100 * sev[k] / cnt[k]), d=round(d / 1000, 2), z=zona),
            )
        )
    write_fc(OUT / "malla500.geojson", feats)

    # ---------- zonas de interés
    feats = []
    for z in ZONAS:
        cx, cy = to_utm.transform(z["lon"], z["lat"])
        circ_utm = Point(cx, cy).buffer(z["r"], 48)
        circ = gpd.GeoSeries([circ_utm], crs=UTM).to_crs(4326).iloc[0]
        m = rasterize([(circ, 1)], out_shape=lst.shape, transform=tr, fill=0, dtype="uint8").astype(bool)
        s = stats(m)
        dz = dist[m & valid]
        props = dict(id=z["id"], nombre=z["nombre"], tipo=z["tipo"], lon=z["lon"], lat=z["lat"], **{f"s_{k}": v for k, v in s.items() if k != "clases"}, clases=s["clases"], d_sc_km=r1(np.median(dz) / 1000))
        feats.append(dict(type="Feature", geometry=round_coords(circ), properties=props))
        print(f"   {z['nombre']:40s} media {s['media']:5} dif {s['dif']:+5} p90 {s['p90']} F+S {s['pct_fuerte_severo']}%  dSC {props['d_sc_km']} km")
    write_fc(OUT / "zonas.geojson", feats)

    # ---------- perfil LST vs distancia al límite del SC (bins de 250 m, -2 a 6 km)
    edges = np.arange(-2000, 6001, 250)
    dv = dist[valid]
    prof = []
    for a, b in zip(edges[:-1], edges[1:]):
        m = (dv >= a) & (dv < b)
        if m.sum() > 200:
            t = v[m]
            prof.append(dict(d=round((a + b) / 2000, 3), media=r1(t.mean()), p25=r1(np.percentile(t, 25)), p75=r1(np.percentile(t, 75)), n=int(m.sum())))

    # ---------- histograma
    hb = np.arange(14, 46.01, 0.5)
    hist, _ = np.histogram(v, bins=hb)

    # ---------- resumen por agregados
    zonas_ag = {}
    for zn in ["Norte", "Centro", "Poniente", "Oriente", "Sur"]:
        ids = [i + 1 for i, u in enumerate(units) if u["zona"] == zn]
        zonas_ag[zn] = stats(np.isin(unit_id, ids))
    zonas_ag["Periferia"] = stats(np.isin(unit_id, [i + 1 for i, u in enumerate(units) if u["ent"] == "Edomex"]))
    gradiente = dict(
        dentro_sc=stats((dist < 0)),
        borde_0_1km=stats((dist >= 0) & (dist < 1000)),
        km_1_3=stats((dist >= 1000) & (dist < 3000)),
        nucleo_mas_3km=stats(dist >= 3000),
    )

    meta = dict(
        fuente="LST_SMW_2022_urb.tif · Landsat, Statistical Mono-Window (SMW), 2022",
        bounds=[bounds.left, bounds.bottom, bounds.right, bounds.top],
        width=W,
        height=H,
        scale=SCALE,
        offset=OFFSET,
        resolucion_m=round(px_y),
        t_media=round(tmean_c, 2),
        t_min=r1(v.min()),
        t_max=r1(v.max()),
        p2=r1(np.percentile(v, 2)),
        p98=r1(np.percentile(v, 98)),
        # paradas de la rampa continua en cuantiles (2, 12, 35, 65, 90, 99): usa toda la paleta
        rampa=[r1(np.percentile(v, q)) for q in (2, 12, 35, 65, 90, 99)],
        umbrales_utfvi=UMBRALES,
        umbrales_c=umbrales_c,
        clases=CLASES,
        paleta_utfvi=["#2b83ba", "#abdda4", "#fdae61", "#f46d43", "#d7191c", "#7f0000"],
        total=stats(valid),
        zonas=zonas_ag,
        gradiente=gradiente,
        perfil=prof,
        histograma=dict(bins=[round(b, 1) for b in hb.tolist()], n=hist.tolist()),
    )
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print("  meta.json listo")
    print(json.dumps(dict(zonas=zonas_ag, gradiente=gradiente), ensure_ascii=False)[:3000])


if __name__ == "__main__":
    main()
