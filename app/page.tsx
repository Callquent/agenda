import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildGrid, formatDay, formatMonth, isValidDate, monthKey, parseMonth, shiftMonth, todayISO, WEEKDAYS } from "@/lib/dates";
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

export default async function Home({ searchParams }: { searchParams: Promise<{ mois?: string; jour?: string }> }) {
  const { mois, jour } = await searchParams;
  const { year, month } = parseMonth(mois);
  const grid = buildGrid(year, month);
  const today = todayISO();

  await ensureSynced(grid.start, grid.end);
  const [byDay, sources] = await Promise.all([
    eventsByDay(grid.start, grid.end),
    prisma.source.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const key = monthKey(year, month);
  const inGrid = (d: string) => d >= grid.start && d <= grid.end;
  const selected = isValidDate(jour) && inGrid(jour) ? jour : today.startsWith(key) ? today : `${key}-01`;
  const dayEvents = byDay.get(selected) ?? [];
  const failing = sources.filter((s) => s.enabled && s.lastError);
  const href = (m: string, d?: string) => `/?mois=${m}${d ? `&jour=${d}` : ""}`;

  return (
    <>
      <div className="cal-head">
        <h1>{formatMonth(year, month)}</h1>
        <div className="cal-nav">
          <Link className="btn quiet small" href={href(shiftMonth(year, month, -1))} aria-label="Mois précédent">‹</Link>
          <Link className="btn quiet small" href={href(today.slice(0, 7), today)}>Aujourd'hui</Link>
          <Link className="btn quiet small" href={href(shiftMonth(year, month, 1))} aria-label="Mois suivant">›</Link>
        </div>
      </div>

      {failing.length > 0 && (
        <p className="panel err">
          {failing.map((s) => s.name).join(", ")} : synchronisation impossible. <Link href="/applications">Voir le détail</Link>
        </p>
      )}

      <div className="main">
        <div>
          <div className="month">
            <div className="dow">{WEEKDAYS.map((d) => <div key={d}>{d}</div>)}</div>
            {grid.weeks.map((week) => (
              <div className="week" key={week[0]}>
                {week.map((d) => {
                  const list = byDay.get(d) ?? [];
                  const cls = ["cell", d.startsWith(key) ? "" : "off", d === today ? "today" : "", d === selected ? "sel" : ""].join(" ");
                  return (
                    <Link key={d} href={href(key, d)} className={cls} aria-label={formatDay(d)} scroll={false}>
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
          <div className="legend" style={{ marginTop: 10 }}>
            <span><i className="dot" style={{ ["--c" as string]: DEFAULT_COLOR }} /> Mon agenda</span>
            {sources.filter((s) => s.enabled).map((s) => (
              <span key={s.id}><i className="dot" style={{ ["--c" as string]: s.color }} /> {s.name}</span>
            ))}
          </div>
        </div>

        <aside className="day">
          <h2>{formatDay(selected)}</h2>
          {dayEvents.length === 0 ? <p className="muted">Rien de prévu ce jour-là.</p> : dayEvents.map((e) => <EventCard key={e.id} ev={e} />)}
          <AddEvent date={selected} />
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
