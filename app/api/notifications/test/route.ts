import { NextResponse } from "next/server";
import { bad } from "@/lib/api";
import { sendToAll } from "@/lib/notify";

// Envoie une notification de test à tous les appareils activés.
export async function POST() {
  const r = await sendToAll("Agenda : test", "Les notifications fonctionnent. Vous recevrez ici les tâches du jour.");
  if (r.devices === 0) return bad("Aucun appareil activé : activez d'abord les notifications sur ce téléphone.", 409);
  if (r.sent === 0) return bad("Aucune notification n'a pu être remise (le service de notification du navigateur est-il joignable ?).", 502);
  return NextResponse.json(r);
}
