import { addDays, isValidDate } from "./dates";

// Répétition d'un événement créé dans l'agenda : tous les X jours OU certains jours de la semaine.
// La série commence à `date` ; les occurrences sont calculées à l'affichage (rien n'est copié dans la base).

export type Repeat = { repeatEvery: number; repeatDays: string; repeatUntil: string };

/** Jours de la semaine au format Date.getDay() : 0 = dimanche … 6 = samedi. Affichés du lundi au dimanche. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const WEEKDAY_PLURAL = ["dimanches", "lundis", "mardis", "mercredis", "jeudis", "vendredis", "samedis"];

export const daysOf = (s: string): number[] =>
  s.split(",").filter(Boolean).map(Number).filter((n, i, a) => Number.isInteger(n) && n >= 0 && n <= 6 && a.indexOf(n) === i);

export const isRecurring = (r: Repeat) => r.repeatEvery > 0 || daysOf(r.repeatDays).length > 0;

export function repeatLabel(r: Repeat): string {
  if (r.repeatEvery > 0) return r.repeatEvery === 1 ? "Tous les jours" : `Tous les ${r.repeatEvery} jours`;
  const wd = daysOf(r.repeatDays);
  if (wd.length === 0) return "";
  if (wd.length === 7) return "Tous les jours";
  return `Tous les ${WEEKDAY_ORDER.filter((d) => wd.includes(d)).map((d) => WEEKDAY_PLURAL[d]).join(", ")}`;
}

const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** Jours (YYYY-MM-DD) entre `from` et `to` où l'événement revient. Jamais avant `date`, jamais après `repeatUntil`. */
export function occurrences(r: Repeat & { date: string }, from: string, to: string): string[] {
  const last = r.repeatUntil && r.repeatUntil < to ? r.repeatUntil : to;
  const first = r.date > from ? r.date : from;
  const out: string[] = [];
  if (first > last) return out;
  if (r.repeatEvery > 0) {
    // On saute directement à la première occurrence de la plage (pas de boucle depuis la création).
    const k = Math.ceil((dayNumber(first) - dayNumber(r.date)) / r.repeatEvery);
    for (let d = addDays(r.date, k * r.repeatEvery), n = 0; d <= last && n < 1000; d = addDays(d, r.repeatEvery), n++) out.push(d);
    return out;
  }
  const wd = new Set(daysOf(r.repeatDays));
  for (let d = first, n = 0; d <= last && n < 1000; d = addDays(d, 1), n++) if (wd.has(weekdayOf(d))) out.push(d);
  return out;
}

/** Valide la répétition envoyée par le formulaire : repeatMode = "none" | "every" | "weekdays". */
export function parseRepeat(b: Record<string, unknown>, date: string): { ok: true; value: Repeat } | { ok: false; error: string } {
  const none: Repeat = { repeatEvery: 0, repeatDays: "", repeatUntil: "" };
  const mode = b.repeatMode;
  if (mode === undefined || mode === "none") return { ok: true, value: none };
  let repeatEvery = 0;
  let repeatDays = "";
  if (mode === "every") {
    const n = Number(b.repeatEvery);
    if (!Number.isInteger(n) || n < 1 || n > 365) return { ok: false, error: "Répétition : nombre de jours entre 1 et 365." };
    repeatEvery = n;
  } else if (mode === "weekdays") {
    const list = Array.isArray(b.repeatDays) ? b.repeatDays.map(Number) : [];
    const days = [...new Set(list)].filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    if (days.length === 0 || days.length !== new Set(list).size) return { ok: false, error: "Répétition : choisissez au moins un jour de la semaine." };
    repeatDays = WEEKDAY_ORDER.filter((d) => days.includes(d)).join(",");
  } else {
    return { ok: false, error: "Répétition invalide." };
  }
  let repeatUntil = "";
  if (typeof b.repeatUntil === "string" && b.repeatUntil !== "") {
    if (!isValidDate(b.repeatUntil) || b.repeatUntil < date) return { ok: false, error: "La date de fin de répétition doit être après le début." };
    repeatUntil = b.repeatUntil;
  }
  return { ok: true, value: { repeatEvery, repeatDays, repeatUntil } };
}

/** Coche ou décoche un jour « fait » dans la liste d'une série (texte « d1,d2,… », triée, bornée). */
export function toggleDone(doneOn: string, date: string): string {
  const set = new Set(doneOn.split(",").filter(Boolean));
  if (set.has(date)) set.delete(date);
  else set.add(date);
  return [...set].sort().slice(-800).join(",");
}
