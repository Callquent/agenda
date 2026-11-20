import type { Source } from "@prisma/client";
import { prisma } from "./prisma";
import { addDays, todayISO } from "./dates";
import { sanitizeFeed } from "./feed";
import { hubApps, hubUrl } from "./hub";

// ---------------------------------------------------------------------------------------------
// Contrat d'une application liée. Elle expose :
//
//   GET /api/agenda?from=YYYY-MM-DD&to=YYYY-MM-DD
//   -> { events: [{ id, title, date, endDate?, time?, status?, category?, path? }] }
//
//   id        identifiant unique de l'occurrence (texte)
//   date      jour de l'événement ; endDate (facultatif) pour un événement sur plusieurs jours
//   status    "todo" (à faire, défaut) | "done" (fait) | "late" (en retard)
//   path      chemin dans l'application pour ouvrir l'élément (ex. "/plantes/abc")
// ---------------------------------------------------------------------------------------------

export const PRESETS = [
  { key: "plantes", name: "Mes plantes", appId: "plantes", match: "plante", color: "#3f8f5a", hint: "Arrosages, semis, levées" },
  { key: "taches", name: "Tâches ménagères", appId: "taches", match: "tache", color: "#c47a2c", hint: "Tâches à refaire et tâches faites" },
  { key: "candidatures", name: "Candidatures", appId: "suivi-candidatures", match: "candidat", color: "#7c3aed", hint: "Dates d'entretien" },
] as const;

/** Adresse où le serveur de l'agenda joint l'application (null = introuvable). */
export async function sourceBase(src: Pick<Source, "appId" | "customUrl">): Promise<string | null> {
  if (src.appId) {
    const hub = await hubUrl();
    return hub ? `${hub}/apps/${src.appId}` : null;
  }
  return src.customUrl ? src.customUrl.replace(/\/+$/, "") : null;
}

/** Préfixe des liens ouverts dans le navigateur : le chemin du hub, ou l'adresse complète. */
export function publicBase(src: Pick<Source, "appId" | "customUrl">): string {
  return src.appId ? `/apps/${src.appId}` : src.customUrl.replace(/\/+$/, "");
}

export async function fetchFeed(src: Pick<Source, "appId" | "customUrl" | "feedPath">, from: string, to: string) {
  const base = await sourceBase(src);
  if (!base) {
    throw new Error(
      src.appId
        ? "« MaPetiteBoîte » est introuvable depuis l'agenda (variable HUB_URL à définir si le port est inhabituel)."
        : "Adresse de l'application manquante.",
    );
  }
  const feedPath = src.feedPath.startsWith("/") ? src.feedPath : `/${src.feedPath}`;
  let res: Response;
  try {
    res = await fetch(`${base}${feedPath}?from=${from}&to=${to}`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
      headers: { accept: "application/json" },
    });
  } catch {
    throw new Error("Application injoignable (est-elle démarrée ?).");
  }
  if (res.status === 404) {
    if (src.appId) {
      const ids = (await hubApps()).map((a) => a.id);
      if (!ids.includes(src.appId)) {
        throw new Error(`Aucune application « ${src.appId} » dans MaPetiteBoîte (trouvées : ${ids.join(", ") || "aucune"}). Corrigez l'identifiant.`);
      }
    }
    throw new Error("L'application n'a pas de flux /api/agenda : réimportez-la avec la version qui le fournit (plantes.zip / taches.zip).");
  }
  if (!res.ok) throw new Error(`L'application a répondu « erreur ${res.status} ».`);
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("json")) throw new Error("Réponse inattendue (ce n'est pas du JSON).");
  return sanitizeFeed(await res.json(), from, to);
}

/** Remplace les dates de cette application entre `from` et `to` par celles que l'application fournit maintenant. */
export async function syncSource(src: Source, from: string, to: string): Promise<{ ok: boolean; count: number; error: string }> {
  try {
    const events = await fetchFeed(src, from, to);
    await prisma.$transaction(async (tx) => {
      await tx.event.deleteMany({ where: { sourceId: src.id, date: { gte: from, lte: to } } });
      if (events.length > 0) await tx.event.createMany({ data: events.map((e) => ({ ...e, sourceId: src.id })) });
      await tx.source.update({ where: { id: src.id }, data: { lastSyncAt: new Date(), lastError: "" } });
    });
    return { ok: true, count: events.length, error: "" };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Erreur inconnue";
    await prisma.source.update({ where: { id: src.id }, data: { lastError: error } }).catch(() => undefined);
    return { ok: false, count: 0, error };
  }
}

/** Fenêtre large utilisée par le bouton « Synchroniser » : un mois en arrière, six mois en avant. */
export const defaultWindow = () => ({ from: addDays(todayISO(), -31), to: addDays(todayISO(), 186) });

// Mémoire de la dernière synchronisation de chaque plage : évite de rappeler les applications à chaque clic.
const g = globalThis as typeof globalThis & { __agendaSyncAt?: Map<string, number> };
const lastSync = (g.__agendaSyncAt ??= new Map());
const TTL_MS = 60_000;

/** Met à jour les applications liées pour la plage affichée (sauf si elles l'ont été il y a moins d'une minute). */
export async function ensureSynced(from: string, to: string, force = false): Promise<void> {
  const sources = await prisma.source.findMany({ where: { enabled: true } });
  await Promise.all(
    sources.map(async (src) => {
      const key = `${src.id}|${from}|${to}`;
      if (!force && Date.now() - (lastSync.get(key) ?? 0) < TTL_MS) return;
      const r = await syncSource(src, from, to);
      if (r.ok) lastSync.set(key, Date.now());
    }),
  );
}

export function forgetSync(sourceId: string) {
  for (const k of lastSync.keys()) if (k.startsWith(`${sourceId}|`)) lastSync.delete(k);
}
