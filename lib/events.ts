import type { Event, Source } from "@prisma/client";
import { prisma } from "./prisma";
import { addDays } from "./dates";
import { publicBase } from "./sources";
import { isRecurring, occurrences, repeatLabel } from "./recur";

export const DEFAULT_COLOR = "#3b82f6";

export type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  endDate: string;
  time: string;
  notes: string;
  category: string;
  status: string;
  color: string;
  href: string; // lien vers l'élément dans l'application d'origine ("" pour un événement de l'agenda)
  sourceId: string | null;
  sourceName: string;
  recurring: boolean; // série répétée (état « fait » propre à chaque jour)
  repeat: string; // « Tous les lundis, mercredis » ("" si non répété)
  start: string; // jour de création / début de série (date = jour affiché pour une occurrence)
  repeatEvery: number;
  repeatDays: string;
  repeatUntil: string;
};

type Row = Event & { source: Source | null };

function toEvent(r: Row): AgendaEvent {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    endDate: r.endDate,
    time: r.time,
    notes: r.notes,
    category: r.category,
    status: r.status,
    color: r.color || r.source?.color || DEFAULT_COLOR,
    href: r.source ? `${publicBase(r.source)}${r.path || "/"}` : "",
    sourceId: r.sourceId,
    sourceName: r.source?.name ?? "",
    recurring: isRecurring(r),
    repeat: repeatLabel(r),
    start: r.date,
    repeatEvery: r.repeatEvery,
    repeatDays: r.repeatDays,
    repeatUntil: r.repeatUntil,
  };
}

/** Événements visibles entre `from` et `to`, rangés par jour (un événement de plusieurs jours est répété chaque jour). */
export async function eventsByDay(from: string, to: string): Promise<Map<string, AgendaEvent[]>> {
  const rows = await prisma.event.findMany({
    where: {
      AND: [
        { date: { lte: to } },
        {
          OR: [
            { endDate: "", date: { gte: from } },
            { endDate: { gte: from, not: "" } },
            // séries répétées : commencées avant la fin de la plage et pas encore terminées
            { AND: [{ OR: [{ repeatEvery: { gt: 0 } }, { repeatDays: { not: "" } }] }, { OR: [{ repeatUntil: "" }, { repeatUntil: { gte: from } }] }] },
          ],
        },
        { OR: [{ sourceId: null }, { source: { enabled: true } }] },
      ],
    },
    include: { source: true },
  });
  const byDay = new Map<string, AgendaEvent[]>();
  const add = (d: string, ev: AgendaEvent) => {
    const list = byDay.get(d) ?? [];
    list.push(ev);
    byDay.set(d, list);
  };
  for (const r of rows) {
    const ev = toEvent(r);
    if (ev.recurring) {
      const done = new Set(r.doneOn.split(",").filter(Boolean));
      for (const d of occurrences(r, from, to)) add(d, { ...ev, date: d, endDate: "", status: done.has(d) ? "done" : "todo" });
      continue;
    }
    const last = ev.endDate || ev.date;
    for (let d = ev.date < from ? from : ev.date; d <= last && d <= to; d = addDays(d, 1)) {
      add(d, ev);
    }
  }
  for (const list of byDay.values()) {
    list.sort(
      (a, b) =>
        (a.time || "99:99").localeCompare(b.time || "99:99") ||
        a.sourceName.localeCompare(b.sourceName, "fr") ||
        a.title.localeCompare(b.title, "fr"),
    );
  }
  return byDay;
}
