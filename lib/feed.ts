import { isValidDate, ISO_TIME } from "./dates";

// Contrat d'une application liée : voir lib/sources.ts (GET /api/agenda?from=&to=).
// Ce fichier ne dépend ni de la base ni du réseau : il se teste seul.

export const STATUSES = ["todo", "done", "late"] as const;
export type Status = (typeof STATUSES)[number];

export type FeedEvent = {
  title: string;
  date: string;
  endDate: string;
  time: string;
  status: Status;
  category: string;
  path: string;
};

const MAX_EVENTS = 5000;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Revérifie champ par champ ce qui vient d'une autre application : rien n'est repris tel quel. */
export function sanitizeFeed(raw: unknown, from: string, to: string): FeedEvent[] {
  const list = raw && typeof raw === "object" ? (raw as { events?: unknown }).events : undefined;
  if (!Array.isArray(list)) throw new Error("Réponse inattendue : le flux doit contenir une liste « events ».");
  const out: FeedEvent[] = [];
  for (const item of list.slice(0, MAX_EVENTS)) {
    const e = (item ?? {}) as Record<string, unknown>;
    const title = text(e.title, 200);
    if (!title || !isValidDate(e.date)) continue;
    const end = isValidDate(e.endDate) && e.endDate > e.date ? e.endDate : "";
    if (e.date > to || (end || e.date) < from) continue;
    const path = text(e.path, 300);
    out.push({
      title,
      date: e.date,
      endDate: end,
      time: typeof e.time === "string" && ISO_TIME.test(e.time) ? e.time : "",
      status: STATUSES.find((s) => s === e.status) ?? "todo",
      category: text(e.category, 60),
      // Seuls les chemins internes à l'application sont gardés (jamais d'adresse extérieure).
      path: path.startsWith("/") && !path.startsWith("//") && !/[\s\\]/.test(path) ? path : "",
    });
  }
  return out;
}

