// Toutes les dates de l'agenda sont des textes « YYYY-MM-DD » : aucun décalage d'heure d'été possible.

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
export const WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

const pad = (n: number) => String(n).padStart(2, "0");

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const utc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export function addDays(iso: string, n: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isValidDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO_DATE.test(s)) return false;
  return utc(s).toISOString().slice(0, 10) === s;
}

export const monthKey = (year: number, month: number) => `${year}-${pad(month)}`;

export function parseMonth(param?: string): { year: number; month: number } {
  const m = param ? MONTH_RE.exec(param) : null;
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  const t = todayISO();
  return { year: Number(t.slice(0, 4)), month: Number(t.slice(5, 7)) };
}

export function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/** Grille d'un mois : semaines du lundi au dimanche, avec les jours des mois voisins qui la complètent. */
export function buildGrid(year: number, month: number): { start: string; end: string; weeks: string[][] } {
  const first = `${monthKey(year, month)}-01`;
  const offset = (utc(first).getUTCDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = addDays(first, -offset);
  const weekCount = Math.ceil((offset + daysInMonth) / 7);
  const weeks: string[][] = [];
  for (let w = 0; w < weekCount; w++) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
  }
  return { start, end: addDays(start, weekCount * 7 - 1), weeks };
}

export function formatDay(iso: string): string {
  const s = utc(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const formatMonth = (year: number, month: number) =>
  `${MONTHS[month - 1].charAt(0).toUpperCase()}${MONTHS[month - 1].slice(1)} ${year}`;
