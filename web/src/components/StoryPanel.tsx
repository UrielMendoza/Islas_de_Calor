import { Fragment, useEffect, useRef } from "react";
import type { Chapter } from "../story";
import type { AppData } from "../types";
import { StoryCard } from "./Cards";
import { tempHex } from "../map/palette";

/** Markdown mínimo: **negritas** y *cursivas*. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith("*") ? <em key={i}>{p.slice(1, -1)}</em> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

function chapterTemp(c: Chapter, d: AppData): number {
  if (c.card?.kind === "zona") {
    const id = c.card.id;
    return d.zonas.features.find((f) => f.properties.id === id)?.properties.s_media ?? d.meta.t_media;
  }
  if (c.card?.kind === "gradiente") return d.meta.gradiente.borde_0_1km.media;
  if (c.card?.kind === "zonas") return d.meta.zonas.Oriente.media;
  return d.meta.t_media;
}

interface Props {
  chapters: Chapter[];
  active: number;
  onActive: (i: number) => void;
  data: AppData;
}

export function StoryPanel({ chapters, active, onActive, data }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const lock = useRef(false);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (lock.current) return;
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) onActive(Number((hit.target as HTMLElement).dataset.idx));
      },
      { root, rootMargin: "-38% 0px -52% 0px", threshold: 0 },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [onActive]);

  const goTo = (i: number) => {
    const el = refs.current[i];
    if (!el || !scroller.current) return;
    lock.current = true;
    onActive(i);
    scroller.current.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
    window.setTimeout(() => (lock.current = false), 900);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goTo(Math.min(chapters.length - 1, active + 1));
      }
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goTo(Math.max(0, active - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="story">
      <nav className="rail" aria-label="Capítulos del recorrido">
        {chapters.map((c, i) => (
          <button
            key={c.id}
            className={`rail-dot ${i === active ? "is-active" : ""} ${i < active ? "is-past" : ""}`}
            style={{ ["--dot" as any]: tempHex(chapterTemp(c, data)) }}
            onClick={() => goTo(i)}
            title={c.title}
            aria-label={`${i + 1}. ${c.title}`}
          />
        ))}
      </nav>
      <div className="story-scroll" ref={scroller}>
        {chapters.map((c, i) => (
          <section key={c.id} data-idx={i} ref={(el) => (refs.current[i] = el)} className={`chapter ${i === active ? "is-active" : ""}`}>
            <div className="kicker">
              <span className="kicker-n">{String(i + 1).padStart(2, "0")}</span>
              {c.kicker}
            </div>
            <h2>{c.title}</h2>
            {c.body.map((p, k) => (
              <p key={k}>
                <Rich text={p} />
              </p>
            ))}
            {c.card && <StoryCard card={c.card} data={data} />}
          </section>
        ))}
        <div className="story-end">
          <span className="draft">Borrador · textos para revisión de los autores</span>
        </div>
      </div>
      <div className="story-nav">
        <button onClick={() => goTo(Math.max(0, active - 1))} disabled={active === 0} aria-label="Capítulo anterior">
          ↑
        </button>
        <span>
          {String(active + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}
        </span>
        <button onClick={() => goTo(Math.min(chapters.length - 1, active + 1))} disabled={active === chapters.length - 1} aria-label="Capítulo siguiente">
          ↓
        </button>
      </div>
    </div>
  );
}
