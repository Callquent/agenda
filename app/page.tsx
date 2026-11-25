import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDays, buildGrid, formatDay, formatMonth, formatWeekRange, isoWeek, isValidDate, mondayOf, monthKey, parseMonth, shiftMonth, todayISO, WEEKDAYS } from "@/lib/dates";
import { DEFAULT_COLOR, eventsByDay, type AgendaEvent } from "@/lib/events";
import { ensureSynced } from "@/lib/sources";
import AddEvent from "@/components/AddEvent";
import ManualActions from "@/components/ManualActions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { done: "Fait", late: "En retard" };

function EventCard({ ev }: { ev: AgendaEvent }) {
  return (
    <div className={`ev ${ev.status}`} style={{ ["--c" as string]: ev.color }}>
      <span className="ev-title">{ev.title}</span>
      <span className="ev-meta">
        {ev.time && <span>{ev.time}</span>}
        {ev.endDate && <span>jusqu'au {formatDay(ev.endDate).toLowerCase()}</span>}
        <span className="tag">{ev.sourceName || "Mon agenda"}</span>
        {ev.repeat && <span>↻ {ev.repeat}</span>}
        {ev.category && <span>{ev.category}</span>}
        {STATUS_LABEL[ev.status] && <span className={`tag ${ev.status === "late" ? "late" : ""}`}>{STATUS_LABEL[ev.status]}</span>}
      </span>
      {ev.notes && <span className="ev-meta">{ev.notes}</span>}
      {ev.sourceId ? (
        ev.href && (
          <a className="ev-meta" href={ev.href}>
            Ouvrir dans {ev.sourceName} →
          </a>
        )
      ) : (
        <ManualActions ev={ev} />
      )}
    </div>
  );
}

type Vue = "semaine" | "mois";

export default async function Home({ searchParams }: { searchParams: Promise<{ mois?: string; jour?: string; vue?: string }> }) {
  const { mois, jour, vue: vueParam } = await searchParams;
  const vue: Vue = vueParam === "mois" ? "mois" : "semaine";
  const today = todayISO();

  // Période affichée : la semaine du jour choisi, ou la grille du mois.
  const { year, month } = parseMonth(isValidDate(jour) && !mois ? jour.slice(0, 7) : mois);
  const grid = buildGrid(year, month);
  const key = monthKey(year, month);
  const anchor = isValidDate(jour) ? jour : today;
  const weekStart = mondayOf(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const range = vue === "semaine" ? { start: weekStart, end: weekDays[6] } : { start: grid.start, end: grid.end };

  await ensureSynced(range.start, range.end);
  const [byDay, sources] = await Promise.all([
    eventsByDay(range.start, range.end),
    prisma.source.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const inRange = (d: string) => d >= range.start && d <= range.end;
  const selected =
    vue === "semaine" ? anchor : isValidDate(jour) && inRange(jour) ? jour : today.startsWith(key) ? today : `${key}-01`;
  const dayEvents = byDay.get(selected) ?? [];
  const lateCount = dayEvents.filter((e) => e.status === "late").length;
  const todoCount = dayEvents.filter((e) => e.status !== "done").length;
  const failing = sources.filter((s) => s.enabled && s.lastError);
  const href = (v: Vue, d: string, m?: string) => `/?vue=${v}&jour=${d}${v === "mois" ? `&mois=${m ?? d.slice(0, 7)}` : ""}`;

  const title = vue === "semaine" ? formatWeekRange(weekStart, weekDays[6]) : formatMonth(year, month);
  const prev = vue === "semaine" ? href("semaine", addDays(anchor, -7)) : href("mois", `${shiftMonth(year, month, -1)}-01`);
  const next = vue === "semaine" ? href("semaine", addDays(anchor, 7)) : href("mois", `${shiftMonth(year, month, 1)}-01`);

  return (
    <>
      <div className="cal-head">
        <div>
          <h1>{title}</h1>
          {vue === "semaine" && <span className="muted">Semaine {isoWeek(weekStart)}</span>}
        </div>
        <div className="cal-tools">
          <div className="seg-view" role="group" aria-label="Affichage">
            <Link href={href("semaine", selected)} aria-current={vue === "semaine" ? "page" : undefined}>Semaine</Link>
            <Link href={href("mois", selected)} aria-current={vue === "mois" ? "page" : undefined}>Mois</Link>
          </div>
          <div className="cal-nav">
            <Link className="btn quiet small" href={prev} aria-label={vue === "semaine" ? "Semaine précédente" : "Mois précédent"}>‹</Link>
            <Link className="btn quiet small" href={href(vue, today)}>Aujourd'hui</Link>
            <Link className="btn quiet small" href={next} aria-label={vue === "semaine" ? "Semaine suivante" : "Mois suivant"}>›</Link>
          </div>
        </div>
      </div>

      {failing.length > 0 && (
        <p className="panel err">
          {failing.map((s) => s.name).join(", ")} : synchronisation impossible. <Link href="/applications">Voir le détail</Link>
        </p>
      )}

      <div className="main">
        <div className="cal-col">
          {vue === "semaine" ? (
            <div className="weekview">
              {weekDays.map((d, i) => {
                const list = byDay.get(d) ?? [];
                const cls = ["wday", d === today ? "today" : "", d === selected ? "sel" : "", list.length === 0 ? "empty" : ""].join(" ");
                return (
                  <Link key={d} href={href("semaine", d)} className={cls} aria-label={formatDay(d)} scroll={false}>
                    <span className="whead">
                      <span className="wname">{WEEKDAYS[i]}</span>
                      <span className="wnum">{Number(d.slice(8))}</span>
                    </span>
                    <span className="wlist">
                      {list.length === 0 && <span className="wnone">Rien de prévu</span>}
                      {list.map((e) => (
                        <span key={e.id + d} className={`wev ${e.status}`} style={{ ["--c" as string]: e.color }}>
                          {e.time && <span className="wtime">{e.time}</span>}
                          <span className="wtitle">{e.title}</span>
                        </span>
                      ))}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="month">
              <div className="dow">{WEEKDAYS.map((d) => <div key={d}>{d}</div>)}</div>
              {grid.weeks.map((week) => (
                <div className="week" key={week[0]}>
                  {week.map((d) => {
                    const list = byDay.get(d) ?? [];
                    const cls = ["cell", d.startsWith(key) ? "" : "off", d === today ? "today" : "", d === selected ? "sel" : ""].join(" ");
                    return (
                      <Link key={d} href={href("mois", d, key)} className={cls} aria-label={formatDay(d)} scroll={false}>
                        <span className="num">{Number(d.slice(8))}</span>
                        <span className="pills">
                          {list.slice(0, 3).map((e) => (
                            <span key={e.id + d} className={`pill ${e.status}`} style={{ ["--c" as string]: e.color }}>{e.title}</span>
                          ))}
                          {list.length > 3 && <span className="more">+{list.length - 3}</span>}
                        </span>
                        <span className="dots">
                          {list.slice(0, 4).map((e) => <span key={e.id + d} className="dot" style={{ ["--c" as string]: e.color }} />)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          <div className="legend">
            <span><i className="dot" style={{ ["--c" as string]: DEFAULT_COLOR }} /> Mon agenda</span>
            {sources.filter((s) => s.enabled).map((s) => (
              <span key={s.id}><i className="dot" style={{ ["--c" as string]: s.color }} /> {s.name}</span>
            ))}
          </div>
        </div>

        <aside className="day">
          <div className="day-head">
            <div>
              <h2>{formatDay(selected)}</h2>
              <span className="muted">
                {selected === today ? "Aujourd'hui · " : ""}
                {dayEvents.length === 0 ? "rien de prévu" : `${todoCount} à faire`}
                {lateCount > 0 && <span className="late-note"> · {lateCount} en retard</span>}
              </span>
            </div>
            <AddEvent date={selected} />
          </div>
          {dayEvents.length === 0 ? <p className="muted empty-note">Journée libre.</p> : dayEvents.map((e) => <EventCard key={e.id} ev={e} />)}
          {sources.length === 0 && (
            <p className="panel muted">
              Liez vos applications (plantes, tâches ménagères…) pour voir leurs dates ici. <Link href="/applications">Lier une application</Link>
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
