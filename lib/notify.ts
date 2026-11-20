import webpush from "web-push";
import { prisma } from "./prisma";
import { todayISO } from "./dates";
import { eventsByDay } from "./events";
import { ensureSynced } from "./sources";
import { buildMessage, defaultConfig, isDue, type NotifyConfig } from "./notify-core";

const CONFIG_KEY = "notify";
const VAPID_KEY = "vapid";
// Identifie le serveur auprès des services de notification (adresse de contact exigée par le protocole).
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:agenda@example.org";

export async function getConfig(): Promise<NotifyConfig> {
  const row = await prisma.setting.findUnique({ where: { key: CONFIG_KEY } });
  if (!row) return defaultConfig();
  try {
    return { ...defaultConfig(), ...(JSON.parse(row.value) as Partial<NotifyConfig>) };
  } catch {
    return defaultConfig();
  }
}

export async function saveConfig(cfg: NotifyConfig): Promise<void> {
  const value = JSON.stringify(cfg);
  await prisma.setting.upsert({ where: { key: CONFIG_KEY }, create: { key: CONFIG_KEY, value }, update: { value } });
}

type Vapid = { publicKey: string; privateKey: string };

/** Clés qui identifient ce serveur auprès des navigateurs ; créées une fois puis conservées dans la base. */
async function vapid(): Promise<Vapid> {
  const row = await prisma.setting.findUnique({ where: { key: VAPID_KEY } });
  if (row) {
    try {
      const k = JSON.parse(row.value) as Vapid;
      if (k.publicKey && k.privateKey) return k;
    } catch {
      /* clés illisibles : on en recrée (les appareils devront se réactiver) */
    }
  }
  const keys = webpush.generateVAPIDKeys();
  const value = JSON.stringify(keys);
  await prisma.setting.upsert({ where: { key: VAPID_KEY }, create: { key: VAPID_KEY, value }, update: { value } });
  return keys;
}

export async function publicKey(): Promise<string> {
  return (await vapid()).publicKey;
}

export type SendResult = { sent: number; failed: number; removed: number; devices: number };

/** Envoie la notification à tous les appareils ; supprime ceux que le navigateur a désabonnés (404/410). */
export async function sendToAll(title: string, body: string): Promise<SendResult> {
  const keys = await vapid();
  const subs = await prisma.pushSub.findMany();
  const payload = JSON.stringify({ title, body, tag: "agenda-jour" });
  const out = await Promise.all(
    subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          vapidDetails: { subject: SUBJECT, ...keys },
          TTL: 6 * 3600, // si le téléphone est éteint, le message l'attend 6 h
          timeout: 10_000,
        });
        return "sent" as const;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSub.delete({ where: { id: s.id } }).catch(() => undefined);
          return "removed" as const;
        }
        return "failed" as const;
      }
    }),
  );
  const n = (k: string) => out.filter((r) => r === k).length;
  return { sent: n("sent"), failed: n("failed"), removed: n("removed"), devices: subs.length };
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
let lastAttempt = 0;

/** Appelée chaque minute : envoie la liste du jour une seule fois par jour, à l'heure choisie (ou dès que possible après). */
export async function runDaily(now = new Date()): Promise<void> {
  const cfg = await getConfig();
  const today = todayISO();
  if (!isDue(cfg, today, hhmm(now))) return;
  if (Date.now() - lastAttempt < 5 * 60_000) return; // en cas d'échec, on réessaie toutes les 5 minutes
  lastAttempt = Date.now();

  try {
    await ensureSynced(today, today, true);
    const msg = buildMessage((await eventsByDay(today, today)).get(today) ?? []);
    if (msg) {
      const r = await sendToAll(msg.title, msg.body);
      if (r.devices === 0) throw new Error("Aucun appareil n'est activé pour recevoir les notifications.");
      if (r.sent === 0) throw new Error("Aucune notification n'a pu être remise (service de notification injoignable ?).");
    }
    await saveConfig({ ...cfg, lastSentOn: today, lastError: "" }); // rien à faire aujourd'hui = rien envoyé
  } catch (e) {
    await saveConfig({ ...cfg, lastError: e instanceof Error ? e.message : "Erreur inconnue" });
  }
}
