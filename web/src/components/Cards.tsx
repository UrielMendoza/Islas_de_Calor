import type { Card } from "../story";
import type { AppData } from "../types";
import { UTFVI_COLORS, UTFVI_DESC, UTFVI_LABELS } from "../map/palette";
import { BigTemp, ClassBar, Histogram, ProfileChart, RankBars, fmt, signed } from "./charts";

export function StoryCard({ card, data }: { card: Card; data: AppData }) {
  const m = data.meta;

  switch (card.kind) {
    case "total":
      return (
        <div className="card">
          <BigTemp value={m.total.media} label={`media de ${fmt(m.total.km2, 0)} km² urbanos`} />
          <Histogram meta={m} />
          <dl className="facts">
            <div>
              <dt>Rango</dt>
              <dd>
                {fmt(m.t_min)}–{fmt(m.t_max)} °C
              </dd>
            </div>
            <div>
              <dt>P10–P90</dt>
              <dd>
                {fmt(m.total.p10)}–{fmt(m.total.p90)} °C
              </dd>
            </div>
            <div>
              <dt>Resolución</dt>
              <dd>≈{m.resolucion_m} m</dd>
            </div>
          </dl>
        </div>
      );

    case "zonas": {
      const rows = ["Oriente", "Centro", "Periferia", "Norte", "Sur", "Poniente"]
        .filter((z) => m.zonas[z])
        .map((z) => ({ label: z, value: m.zonas[z].media, sub: `${fmt(m.zonas[z].pct_fuerte_severo)}% fuerte+severo` }))
        .sort((a, b) => b.value - a.value);
      return (
        <div className="card">
          <div className="card-title">Temperatura media por zona</div>
          <RankBars rows={rows} />
        </div>
      );
    }

    case "utfvi":
      return (
        <div className="card">
          <div className="card-title">Clases UTFVI · % del área urbana</div>
          <ul className="utfvi-table">
            {UTFVI_LABELS.map((l, i) => {
              const lo = i === 0 ? null : m.umbrales_c[i - 1];
              const hi = i === 5 ? null : m.umbrales_c[i];
              const range = lo === null ? `< ${fmt(hi!)}°` : hi === null ? `≥ ${fmt(lo)}°` : `${fmt(lo)}–${fmt(hi)}°`;
              return (
                <li key={l}>
                  <i style={{ background: UTFVI_COLORS[i] }} />
                  <span className="u-name">
                    {l}
                    <small>{UTFVI_DESC[i]}</small>
                  </span>
                  <span className="u-range">{range}</span>
                  <b>{fmt(m.total.clases[i])}%</b>
                </li>
              );
            })}
          </ul>
          <p className="card-note">
            Umbrales del código del proyecto sobre UTFVI (0, 0.005, 0.010, 0.015, 0.020), traducidos a °C con T̄ = {fmt(m.t_media, 2)} °C.
          </p>
        </div>
      );

    case "gradiente": {
      const g = m.gradiente;
      const rows = [
        { label: "Dentro del SC", value: g.dentro_sc.media },
        { label: "Borde 0–1 km", value: g.borde_0_1km.media },
        { label: "1–3 km", value: g.km_1_3.media },
        { label: "Núcleo > 3 km", value: g.nucleo_mas_3km.media },
      ];
      return (
        <div className="card">
          <ProfileChart meta={m} />
          <RankBars rows={rows} />
          <p className="card-note">
            Salto de {fmt(g.borde_0_1km.media - g.dentro_sc.media)} °C entre el interior del Suelo de Conservación y el primer kilómetro urbano; sólo{" "}
            {fmt(g.nucleo_mas_3km.media - g.borde_0_1km.media)} °C más hacia el núcleo.
          </p>
        </div>
      );
    }

    case "malla": {
      const cells = data.malla.features;
      const hot = cells.filter((f) => f.properties.c >= 5).length;
      const cool = cells.filter((f) => f.properties.c === 1).length;
      return (
        <div className="card">
          <dl className="facts is-big">
            <div>
              <dt>Celdas de 500 m</dt>
              <dd>{cells.length.toLocaleString("es-MX")}</dd>
            </div>
            <div>
              <dt>Fuerte / severo</dt>
              <dd className="t-hot">{hot}</dd>
            </div>
            <div>
              <dt>Inexistente</dt>
              <dd className="t-cool">{cool.toLocaleString("es-MX")}</dd>
            </div>
          </dl>
          <p className="card-note">Altura = (LST media − 20 °C) × 110 m. Sólo celdas con al menos un 25 % de píxeles válidos.</p>
        </div>
      );
    }

    case "zona": {
      const f = data.zonas.features.find((z) => z.properties.id === card.id);
      if (!f) return null;
      const p = f.properties;
      return (
        <div className="card">
          <BigTemp value={p.s_media} dif={p.s_dif} label={`media en ${fmt(p.s_km2, 0)} km² con dato`} />
          <ClassBar clases={p.clases} />
          <dl className="facts">
            <div>
              <dt>P10 · P90</dt>
              <dd>
                {fmt(p.s_p10)} · {fmt(p.s_p90)} °C
              </dd>
            </div>
            <div>
              <dt>Fuerte+severo</dt>
              <dd>{fmt(p.s_pct_fuerte_severo)}%</dd>
            </div>
            <div>
              <dt>Al límite SC</dt>
              <dd>{p.d_sc_km < 0 ? `${fmt(-p.d_sc_km)} km dentro` : `${fmt(p.d_sc_km)} km`}</dd>
            </div>
          </dl>
        </div>
      );
    }

    case "cierre":
      return (
        <div className="card">
          <div className="formula">
            S(i,z;α) = (1−α)·Σ<sub>k</sub> w<sub>ik</sub>·x<sub>kz</sub> + <b>α·h(z)</b>
          </div>
          <dl className="facts">
            <div>
              <dt>E0</dt>
              <dd>sin mapa térmico</dd>
            </div>
            <div>
              <dt>EH</dt>
              <dd>con mapa térmico</dd>
            </div>
            <div>
              <dt>Eα</dt>
              <dd>α ∈ [0, 0.40]</dd>
            </div>
          </dl>
          <p className="card-note">
            Diferencia oriente–poniente: {signed(m.zonas.Oriente.media - m.zonas.Poniente.media)} °C. Borde vs. núcleo:{" "}
            {signed(m.gradiente.borde_0_1km.media - m.gradiente.nucleo_mas_3km.media)} °C.
          </p>
        </div>
      );
  }
}
