import type { AgendaEvent } from "./events";
import { ISO_TIME } from "./dates";

// Partie sans base ni réseau des notifications : réglages, validation, texte du message, moment d'envoi.

export type NotifyConfig = {
  enabled: boolean;
  time: string; // HH:MM, heure d'envoi quotidienne
  lastSentOn: string; // YYYY-MM-DD du dernier envoi (ou jour sans rien à envoyer)
  lastError: string;
};

export const defaultConfig = (): NotifyConfig => ({ enabled: false, time: "08:00", lastSentOn: "", lastError: "" });

/** Valide les réglages envoyés par le formulaire. */
export function validateConfig(b: Record<string, unknown>): { ok: true; value: Pick<NotifyConfig, "enabled" | "time"> } | { ok: false; error: string } {
  const time = typeof b.time === "string" ? b.time : "";
  if (!ISO_TIME.test(time)) return { ok: false, error: "Heure invalide." };
  return { ok: true, value: { enabled: b.enabled === true, time } };
}

// Le serveur envoie un message à l'adresse fournie par l'appareil : on n'accepte donc que les services de notification
// connus des navigateurs (Chrome/Android, Firefox, Safari/iPhone, Edge), jamais une adresse quelconque.
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com", ".notify.windows.com"];

export type Subscription = { endpoint: string; p256dh: string; auth: string };

export function validateSubscription(raw: unknown): { ok: true; value: Subscription } | { ok: false; error: string } {
  const s = (raw ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const key = /^[A-Za-z0-9_-]{16,200}$/;
  if (typeof s.endpoint !== "string" || s.endpoint.length > 2000) return { ok: false, error: "Abonnement invalide." };
  let host: string;
  try {
    const u = new URL(s.endpoint);
    if (u.protocol !== "https:") return { ok: false, error: "Abonnement invalide." };
    host = u.hostname;
  } catch {
    return { ok: false, error: "Abonnement invalide." };
  }
  if (!PUSH_HOSTS.some((h) => (h.startsWith(".") ? host.endsWith(h) : host === h))) {
    return { ok: false, error: "Service de notification du navigateur non reconnu." };
  }
  const p256dh = s.keys?.p256dh;
  const auth = s.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string" || !key.test(p256dh) || !key.test(auth)) {
    return { ok: false, error: "Clés de l'abonnement invalides." };
  }
  return { ok: true, value: { endpoint: s.endpoint, p256dh, auth } };
}

const MAX_LINES = 15;
const MAX_CHARS = 1200; // une notification web ne peut guère dépasser 4 Ko une fois chiffrée

/** Titre et texte de la notification du jour (tâches à faire et en retard ; ce qui est fait n'y figure pas). */
export function buildMessage(events: AgendaEvent[]): { title: string; body: string } | null {
  const todo = events.filter((e) => e.status !== "done");
  if (todo.length === 0) return null;
  const lines = todo.slice(0, MAX_LINES).map((e) => {
    const where = e.sourceName ? ` (${e.sourceName})` : "";
    return `${e.status === "late" ? "⚠ " : "• "}${e.time ? `${e.time} ` : ""}${e.title}${where}`;
  });
  if (todo.length > MAX_LINES) lines.push(`… et ${todo.length - MAX_LINES} autre${todo.length - MAX_LINES > 1 ? "s" : ""}`);
  let body = lines.join("\n");
  if (body.length > MAX_CHARS) body = `${body.slice(0, MAX_CHARS - 1)}…`;
  return { title: `Aujourd'hui : ${todo.length} à faire`, body };
}

/** Envoi dû si activé, heure atteinte et rien d'envoyé aujourd'hui (rattrape un PC allumé après l'heure prévue). */
export function isDue(cfg: NotifyConfig, today: string, hhmm: string): boolean {
  return cfg.enabled && cfg.lastSentOn !== today && hhmm >= cfg.time;
}
