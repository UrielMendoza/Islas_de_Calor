# Islas de Calor · Valle de México

**Mapas, decisiones residenciales y calor urbano**: un experimento espacial con población sintética, AHP y perturbaciones informacionales en la Ciudad de México y su periferia metropolitana.

Este repositorio contiene la propuesta de investigación, los insumos y el **geoportal** (atlas web interactivo) que muestra la zonificación térmica urbana. El geoportal pone énfasis en la **franja de transición entre el área urbana y las áreas naturales** y en la **periferia conurbada**.

> **Geoportal:** `https://urielmendoza.github.io/Islas_de_Calor/` (se publica con GitHub Actions; ver [Publicación](#publicación)).
> Versión **demo 0.1**: los textos del recorrido son borradores y algunas capas son de prueba.

---

## Pregunta de investigación

> ¿Cómo cambia la elección residencial de hogares sintéticos cuando consultan la capa de disconfort térmico del proyecto, en presencia de restricciones de renta y de otras capas metropolitanas?

La elección residencial se modela con el **Proceso Analítico Jerárquico (AHP)**. Para cada hogar *i* y zona factible *z*:

```
S(i,z;α) = (1−α) · Σ_k w(i,k) · x(k,z)  +  α · h(z)
```

donde `h(z)` es la conveniencia térmica normalizada (derivada de la capa de calor) y `α` el peso del calor (0 a 0.40).

| Escenario | Variación informacional |
|---|---|
| **E0** Base | Renta, conectividad, seguridad, áreas verdes y servicios, sin capa térmica |
| **EH** Informado | Se revela el índice de disconfort del proyecto |
| **E−k** Ablación | Se retira un criterio a la vez |
| **Eα** Sensibilidad | El peso térmico varía de 0 a 0.40 |

Hipótesis: **H1** reordenamiento espacial · **H2** heterogeneidad según perfil y presupuesto · **H3** brecha de capacidad (zonas confortables fuera del conjunto asequible).

Documentos completos en [`docs/`](docs/):
- [Propuesta de investigación v2.0](docs/Propuesta_RESIDENCIAL_AHP_ZMVM_CORREGIDA_v2.pdf)
- [Reporte de fuentes complementarias](docs/Reporte_CORREGIDO_fuentes_complementarias_AHP_ZMVM_2026.pdf)
- [Inventario de fuentes, matriz AHP y esquema de insumos (xlsx)](docs/Fuentes_AHP_COMPLEMENTARIAS_ZMVM_2026.xlsx)

---

## La capa térmica

| | |
|---|---|
| Archivo | [`data/LST_SMW_2022_urb.tif`](data/LST_SMW_2022_urb.tif) |
| Variable | Temperatura superficial terrestre (LST), °C |
| Origen | Landsat, método *Statistical Mono-Window* (SMW), 2022 |
| Resolución | ≈ 30 m (0.000269°), EPSG:4326, máscara urbana |
| Extensión | CDMX y municipios conurbados del Estado de México |

### Índice UTFVI (disconfort / variación del campo térmico urbano)

El **Urban Thermal Field Variance Index** compara cada píxel con la temperatura media de la mancha urbana (en kelvin):

```
UTFVI = (LST − T̄) / T̄
```

Se clasifica con los umbrales y la paleta del código de Earth Engine del equipo:

| Clase | UTFVI | °C equivalentes (T̄ = 33.23 °C) | Color |
|---|---|---|---|
| 1 Inexistente | < 0 | < 33.2 | `#2b83ba` |
| 2 Normal | 0 – 0.005 | 33.2 – 34.8 | `#abdda4` |
| 3 Débil | 0.005 – 0.010 | 34.8 – 36.3 | `#fdae61` |
| 4 Moderado | 0.010 – 0.015 | 36.3 – 37.8 | `#f46d43` |
| 5 Fuerte | 0.015 – 0.020 | 37.8 – 39.4 | `#d7191c` |
| 6 Severo | ≥ 0.020 | ≥ 39.4 | `#7f0000` |

### Resultados preliminares (calculados por `scripts/prepare_data.py`)

**Gradiente urbano–natural** (distancia al límite del Suelo de Conservación de la CDMX):

| Franja | LST media |
|---|---|
| Dentro del Suelo de Conservación (urbanizado) | 29.8 °C |
| Borde urbano 0–1 km | 32.4 °C |
| 1–3 km | 33.3 °C |
| Núcleo > 3 km | 33.8 °C |

La temperatura sube con rapidez en el primer kilómetro fuera del límite y después se estabiliza.

**Por zona:** Oriente 35.6 °C · Centro 33.9 · Periferia (Edomex) 33.8 · Norte 33.6 · Sur 31.6 · Poniente 29.7.

---

## El geoportal

Aplicación **React + TypeScript + Vite** con **MapLibre GL JS**.

**Modo Recorrido** (*scrollytelling*): 15 capítulos que empiezan con la ciudad y sus polígonos y continúan con el índice UTFVI y la franja de transición, la malla de 500 m en 3D y nueve zonas de interés (Sierra de Guadalupe, barrancas del poniente, Ajusco medio, Xochimilco, Sierra de Santa Catarina, Chapultepec, Aeropuerto, Nezahualcóyotl y Ecatepec). Cada capítulo mueve la cámara, activa sus capas y muestra una tarjeta con cifras leídas de los datos.

**Modo Explorar**, con navegación libre:
- **Panel de capas**: LST continua / UTFVI 6 clases / ninguna; filtro de rango de temperatura («sólo islas de calor», «sólo zonas frescas»); opacidad; malla 500 m 3D; límites (alcaldías, zonas, periferia, Suelo de Conservación, franja de transición, zonas de interés); parques OSM; relieve.
- **Edificios 3D** de OpenStreetMap, con color neutro o según la temperatura del píxel que ocupan.
- **Mapas base**: oscuro, claro, calles (OpenStreetMap vía OpenFreeMap), OSM estándar y satélite.
- **Vista 2D / 3D**, relieve del terreno, tema claro/oscuro.
- **Simbología dinámica** y lector de temperatura bajo el cursor.
- Clic en alcaldías, municipios o zonas: ficha con estadísticas.

### Estructura

```
data/
  LST_SMW_2022_urb.tif          ráster original
  vector/                       límites descargados (alcaldías, suelo de conservación, Edomex)
docs/                           propuesta, reporte e inventario de fuentes
scripts/
  prepare_data.py               procesa el ráster y genera los datos del portal
web/
  public/data/                  datos ya procesados (se publican tal cual)
  src/
    story.ts                    ← TEXTOS Y CÁMARAS DEL RECORRIDO (editar aquí)
    map/                        capas MapLibre, paleta, ráster LST
    components/                 paneles, tarjetas, gráficas, simbología
.github/workflows/deploy.yml    publicación en GitHub Pages
```

### Datos generados (`web/public/data/`)

| Archivo | Contenido |
|---|---|
| `lst_grid.png` | LST cuantizada a 8 bits (0 = sin dato; `T = 10 + (v−1)·0.15` °C). El navegador la colorea al vuelo |
| `meta.json` | Georreferencia, umbrales UTFVI, estadísticas, perfil de gradiente, histograma |
| `alcaldias.geojson` | 16 alcaldías + zona + estadísticas |
| `periferia.geojson` | Municipios del Edomex cubiertos por el ráster + estadísticas |
| `conservacion.geojson` | Suelo de Conservación CDMX |
| `transicion.geojson` | Franja de ±1 km del límite del Suelo de Conservación |
| `malla500.geojson` | Malla de 500 m (UTM 14N) con LST media y clase UTFVI |
| `zonas.geojson` | Zonas de interés del recorrido + estadísticas |

---

## Uso local

Requisitos: **Node 20+** y, para regenerar datos, **Python 3.10+** con `rasterio geopandas scipy pillow pyproj requests`.

```bash
# 1. (opcional) regenerar datos a partir del ráster
python scripts/prepare_data.py

# 2. levantar el portal
cd web
npm install
npm run dev          # http://localhost:5173/Islas_de_Calor/
npm run build        # compila en web/dist
```

### Cómo hacer cambios

| Quiero… | Dónde |
|---|---|
| Editar textos, títulos o el orden del recorrido | `web/src/story.ts` |
| Cambiar la cámara de un capítulo | `camera` en `web/src/story.ts` |
| Reemplazar las zonas de interés | Lista `ZONAS` en `scripts/prepare_data.py` (o reemplazar `zonas.geojson` con polígonos propios que tengan las mismas propiedades) |
| Cambiar la agrupación de alcaldías en zonas | `ZONA_ALCALDIA` en `scripts/prepare_data.py` |
| Usar otro ráster (otro año, índice ya calculado) | Reemplazar `data/LST_SMW_2022_urb.tif` y ejecutar `prepare_data.py` |
| Paleta de colores | `web/src/map/palette.ts` |
| Mapas base | `web/src/map/basemaps.ts` |

---

## Publicación

El flujo [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compila `web/` y publica `web/dist` en GitHub Pages con cada *push* a `main`.

Configuración (una sola vez): **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Si el repositorio cambia de nombre, actualizar `base` en `web/vite.config.ts`.

---

## Pendientes de la versión demo

- [ ] Revisión de los textos del recorrido por los autores.
- [ ] Polígonos definitivos de las zonas de interés (ahora son círculos de 2 km de **prueba**).
- [ ] Validar la agrupación de alcaldías en cinco zonas.
- [ ] Límite de áreas naturales del lado Edomex (Sierra de Guadalupe, Sierra de las Cruces): hoy sólo se usa el Suelo de Conservación de la CDMX.
- [ ] Incorporar capas complementarias del AHP (renta, conectividad, seguridad, vegetación, servicios).
- [ ] Escenarios E0 / EH / Eα y mapas de transición de hogares sintéticos.
- [ ] Cobertura de edificios OSM incompleta en la periferia: valorar otra fuente de huellas (p. ej. Overture/Google Open Buildings).

## Fuentes y créditos

- LST: Landsat (USGS/NASA), procesado por el equipo del proyecto con SMW en Google Earth Engine.
- Alcaldías y Suelo de Conservación: Portal de Datos Abiertos de la CDMX.
- Municipios del Estado de México: Marco Geoestadístico INEGI (vía `PhantomInsights/mexico-geojson`).
- Mapas base: © colaboradores de OpenStreetMap, OpenFreeMap / OpenMapTiles; Esri World Imagery.
- Elevación: Terrarium (Mapzen / AWS Terrain Tiles).

Licencia: [GPL-3.0](LICENSE).
