import type { Camera, LayerState } from "./types";

/**
 * RECORRIDO NARRATIVO
 * ------------------------------------------------------------------
 * Cada capítulo define: cámara, capas visibles y texto.
 * Los textos son BORRADORES escritos a partir de las estadísticas
 * calculadas por scripts/prepare_data.py; deben revisarlos los autores.
 * Las cifras de las tarjetas se leen de los datos (no están escritas a mano).
 *
 * Sintaxis de texto: **negritas** y párrafos como elementos del arreglo.
 */

export type Card =
  | { kind: "total" }
  | { kind: "zonas" }
  | { kind: "utfvi" }
  | { kind: "gradiente" }
  | { kind: "malla" }
  | { kind: "zona"; id: string }
  | { kind: "cierre" };

export interface Chapter {
  id: string;
  kicker: string;
  title: string;
  body: string[];
  camera: Camera;
  layers: Partial<LayerState>;
  card?: Card;
  focusZona?: string;
  /** Temperatura representativa para el riel termométrico (se toma de los datos si se omite). */
  tempKey?: string;
}

const BASE: Partial<LayerState> = {
  thermal: "lst",
  malla: false,
  edificios: false,
  alcaldias: true,
  zonasTinte: false,
  periferia: true,
  sc: false,
  transicion: false,
  zonas: false,
  verde: false,
};

const ZONA_LAYERS: Partial<LayerState> = { ...BASE, thermal: "lst", sc: true, transicion: true, zonas: true, alcaldias: false, periferia: false, edificios: true, edificiosColor: "temperatura" };

export const CHAPTERS: Chapter[] = [
  {
    id: "intro",
    kicker: "Valle de México · Landsat 2022",
    title: "Una ciudad que no se calienta por igual",
    body: [
      "Este atlas muestra la **temperatura superficial (LST)** de la Ciudad de México y de su periferia conurbada, a partir de imágenes Landsat de 2022 procesadas con el método *Statistical Mono-Window*. Cada píxel mide unos 30 m.",
      "La pregunta del proyecto es residencial: **¿cambia la elección de dónde vivir cuando un hogar puede consultar este mapa?** Antes de modelar esas decisiones, conviene entender dónde se concentra el calor y, sobre todo, qué ocurre en el borde donde la ciudad se encuentra con sus áreas naturales.",
    ],
    camera: { center: [-99.13, 19.44], zoom: 9.7, pitch: 0, bearing: 0 },
    layers: { ...BASE },
    card: { kind: "total" },
  },
  {
    id: "zonas",
    kicker: "Unidades de análisis",
    title: "Cinco zonas y una periferia",
    body: [
      "Las 16 alcaldías se agrupan en **cinco zonas** (norte, centro, poniente, oriente y sur), como en la propuesta. Los municipios conurbados del Estado de México que cubre el ráster forman la **periferia metropolitana**.",
      "El contraste es inmediato: el **oriente** (Iztapalapa y Tláhuac) es la zona más caliente, mientras que el **poniente**, con barrancas y laderas boscosas, es la más fresca.",
    ],
    camera: { center: [-99.14, 19.39], zoom: 10.1, pitch: 35, bearing: -12 },
    layers: { ...BASE, thermal: "none", zonasTinte: true },
    card: { kind: "zonas" },
  },
  {
    id: "utfvi",
    kicker: "El índice",
    title: "UTFVI: cuánto se aleja cada lugar de la media urbana",
    body: [
      "El **Índice de Variación del Campo Térmico Urbano (UTFVI)** compara la temperatura de cada píxel con la media de toda la mancha urbana: UTFVI = (LST − T̄) / T̄, en kelvin. Es la base del índice de disconfort térmico que usa el proyecto.",
      "Con los umbrales del código del equipo se obtienen seis clases ecológicas, de **Inexistente** (más fresco que la media) a **Severo**. Las clases Fuerte y Severo marcan las islas de calor propiamente dichas.",
    ],
    camera: { center: [-99.12, 19.42], zoom: 10.3, pitch: 0, bearing: 0 },
    layers: { ...BASE, thermal: "utfvi" },
    card: { kind: "utfvi" },
  },
  {
    id: "transicion",
    kicker: "Franja de transición",
    title: "Donde la ciudad toca el bosque",
    body: [
      "La línea verde punteada es el límite oficial del **Suelo de Conservación** de la CDMX. A ambos lados se marca una franja de 1 km: hacia fuera, el **borde urbano** (amarillo); hacia dentro, la **urbanización que ya ocupa suelo de conservación** (verde claro).",
      "El perfil es contundente: la temperatura **sube con rapidez en el primer kilómetro** fuera del límite y después se estabiliza. La franja de transición funciona como un amortiguador térmico, y por eso es también donde la presión urbana tiene más consecuencias.",
    ],
    camera: { center: [-99.17, 19.29], zoom: 10.9, pitch: 50, bearing: 20 },
    layers: { ...BASE, thermal: "lst", sc: true, transicion: true, periferia: false },
    card: { kind: "gradiente" },
  },
  {
    id: "malla",
    kicker: "Unidad del experimento",
    title: "La malla de 500 m en tres dimensiones",
    body: [
      "La propuesta trabaja con una **malla regular de 500 m** que reúne todas las capas del modelo AHP: renta, conectividad, seguridad, vegetación, servicios y calor. Aquí cada celda se eleva según su temperatura media y se colorea según su clase.",
      "El relieve térmico deja ver la **meseta caliente del oriente** y los valles fríos del poniente y el sur. En el modelo esta superficie se convertirá en h(z), la conveniencia térmica de cada zona.",
    ],
    camera: { center: [-99.1, 19.36], zoom: 10.4, pitch: 62, bearing: -28 },
    layers: { ...BASE, thermal: "none", malla: true, alcaldias: false, periferia: false },
    card: { kind: "malla" },
  },
  {
    id: "z-guadalupe",
    kicker: "Transición · norte",
    title: "Sierra de Guadalupe y Cuautepec",
    body: [
      "En el norte, los barrios de Cuautepec suben por las laderas hasta tocar el área natural de la Sierra de Guadalupe. La zona queda **unos dos grados por debajo de la media metropolitana**, gracias a la altitud y a la vegetación de la sierra.",
      "Como en el resto del borde, la temperatura sube a medida que las manzanas se alejan del límite y bajan hacia el valle. **Proteger el borde forestal también es proteger el confort térmico de estos barrios.**",
    ],
    camera: { center: [-99.14, 19.552], zoom: 14, pitch: 60, bearing: -20 },
    layers: ZONA_LAYERS,
    card: { kind: "zona", id: "guadalupe" },
    focusZona: "guadalupe",
  },
  {
    id: "z-poniente",
    kicker: "Transición · poniente",
    title: "Barrancas del poniente",
    body: [
      "Las barrancas de Álvaro Obregón y Cuajimalpa se meten como **corredores frescos** dentro de la ciudad. Con una media cercana a 29 °C, esta es una de las zonas más frescas del área urbana.",
      "La mancha urbana se adapta a la topografía: los conjuntos de Santa Fe en las mesetas se calientan, mientras que los cauces arbolados conservan temperaturas propias del suelo natural.",
    ],
    camera: { center: [-99.262, 19.362], zoom: 14, pitch: 62, bearing: 35 },
    layers: ZONA_LAYERS,
    card: { kind: "zona", id: "poniente" },
    focusZona: "poniente",
  },
  {
    id: "z-ajusco",
    kicker: "Transición · sur",
    title: "Ajusco medio: urbanización dentro del suelo de conservación",
    body: [
      "Buena parte de esta zona está **dentro** del Suelo de Conservación. Es la más fresca del recorrido, casi cinco grados por debajo de la media.",
      "Aquí aparece la tensión central del proyecto (hipótesis H3): las zonas térmicamente más confortables suelen coincidir con **crecimiento irregular sobre suelo forestal**. Un mapa de calor podría empujar la demanda justo hacia donde la ciudad no debería crecer.",
    ],
    camera: { center: [-99.205, 19.262], zoom: 14, pitch: 60, bearing: -40 },
    layers: ZONA_LAYERS,
    card: { kind: "zona", id: "ajusco" },
    focusZona: "ajusco",
  },
  {
    id: "z-xochimilco",
    kicker: "Transición · sur",
    title: "Xochimilco: el borde chinampero",
    body: [
      "La zona lacustre de Xochimilco y sus canales enfrían el contacto entre la ciudad y la zona chinampera. Aunque el tejido urbano es denso, la temperatura queda **cerca de dos grados por debajo de la media**.",
      "Es una transición distinta, en la que el agua cumple el papel que el bosque cumple en otras zonas. Su permanencia depende de que la mancha urbana no siga avanzando sobre los humedales.",
    ],
    camera: { center: [-99.105, 19.262], zoom: 14, pitch: 58, bearing: 15 },
    layers: ZONA_LAYERS,
    card: { kind: "zona", id: "xochimilco" },
    focusZona: "xochimilco",
  },
  {
    id: "z-catarina",
    kicker: "Transición · oriente",
    title: "Sierra de Santa Catarina: no toda transición es fresca",
    body: [
      "A diferencia de las sierras boscosas, Santa Catarina es un conjunto volcánico **con poca vegetación**. Su borde urbano queda **por encima de la media metropolitana** y registra los porcentajes de clases Fuerte y Severo más altos entre las zonas de transición.",
      "Esto matiza la lectura: estar junto a un área natural no garantiza confort térmico. Lo que lo determina es **el tipo de cobertura** (bosque, matorral, roca o suelo desnudo).",
    ],
    camera: { center: [-99.025, 19.322], zoom: 14, pitch: 60, bearing: 60 },
    layers: ZONA_LAYERS,
    card: { kind: "zona", id: "catarina" },
    focusZona: "catarina",
  },
  {
    id: "z-chapultepec",
    kicker: "Contraste intraurbano",
    title: "Chapultepec: una isla fresca en el centro",
    body: [
      "Lejos de cualquier borde natural, el Bosque de Chapultepec baja la temperatura **más de tres grados** respecto a la media. Es la prueba de que el arbolado urbano consolidado reproduce, a escala de barrio, el efecto de la franja de transición.",
      "Para el modelo AHP, este contraste muestra que **la variable térmica no es redundante con la distancia al borde**: también depende de la vegetación interior.",
    ],
    camera: { center: [-99.193, 19.418], zoom: 14, pitch: 60, bearing: -10 },
    layers: ZONA_LAYERS,
    card: { kind: "zona", id: "chapultepec" },
    focusZona: "chapultepec",
  },
  {
    id: "z-aeropuerto",
    kicker: "Contraste · núcleo caliente",
    title: "Aeropuerto y ex vaso de Texcoco",
    body: [
      "El polo más caliente del mapa. Las pistas, las grandes superficies selladas y los suelos salinos desnudos del antiguo lago llevan la temperatura **más de cinco grados por encima** de la media, y **cerca de la mitad del área** queda en las clases Fuerte o Severo.",
      "No es una zona residencial, pero calienta su entorno: las colonias vecinas de Venustiano Carranza y Nezahualcóyotl heredan parte de ese calor.",
    ],
    camera: { center: [-99.075, 19.436], zoom: 12.8, pitch: 55, bearing: 25 },
    layers: { ...ZONA_LAYERS, thermal: "utfvi" },
    card: { kind: "zona", id: "aeropuerto" },
    focusZona: "aeropuerto",
  },
  {
    id: "z-neza",
    kicker: "Periferia · oriente",
    title: "Nezahualcóyotl: calor homogéneo",
    body: [
      "Una de las periferias más densas del país. Con una retícula uniforme y casi sin áreas verdes, la temperatura es **alta y muy pareja**: el percentil 90 apenas se separa de la media.",
      "Es el caso opuesto al borde forestal, un lugar sin gradiente al que escapar dentro del vecindario. Para hogares con presupuesto limitado, este puede ser el **conjunto factible real**.",
    ],
    camera: { center: [-99.015, 19.4], zoom: 14, pitch: 60, bearing: -30 },
    layers: { ...ZONA_LAYERS, periferia: true },
    card: { kind: "zona", id: "neza" },
    focusZona: "neza",
  },
  {
    id: "z-ecatepec",
    kicker: "Periferia · norte",
    title: "Ecatepec: periferia entre sierras",
    body: [
      "Ecatepec se extiende entre la Sierra de Guadalupe y el antiguo lago. Está **por encima de la media**, aunque menos que Nezahualcóyotl, porque las laderas de la sierra aportan algo de frescor en su borde poniente.",
      "Los datos de la periferia del Estado de México son clave para el experimento: aquí se concentra buena parte de la **oferta de vivienda asequible** de la metrópoli.",
    ],
    camera: { center: [-99.05, 19.6], zoom: 14, pitch: 58, bearing: 10 },
    layers: { ...ZONA_LAYERS, periferia: true },
    card: { kind: "zona", id: "ecatepec" },
    focusZona: "ecatepec",
  },
  {
    id: "cierre",
    kicker: "Siguiente paso",
    title: "Del mapa a la decisión residencial",
    body: [
      "Esta capa térmica entra al modelo como **h(z)**: S(i,z;α) = (1−α)·Σ w(i,k)·x(k,z) + α·h(z). Los escenarios comparan qué zona elige cada hogar sintético **sin** el mapa (E0) y **con** el mapa (EH), y cómo cambia esa elección cuando α va de 0 a 0.40.",
      "La franja de transición es donde esa comparación será más sensible: zonas frescas, a menudo asequibles, pero sobre suelo que conviene proteger. **Usa el modo Explorar** para recorrer libremente el mapa, cambiar capas y consultar cualquier punto.",
    ],
    camera: { center: [-99.13, 19.42], zoom: 9.9, pitch: 30, bearing: 0 },
    layers: { ...BASE, thermal: "utfvi", sc: true, transicion: true, zonas: true },
    card: { kind: "cierre" },
  },
];
