import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, body } from "@/lib/api";
import { getConfig, saveConfig } from "@/lib/notify";
import { validateConfig } from "@/lib/notify-core";

export async function PUT(req: Request) {
  const b = await body(req);
  if (!b) return bad("Données invalides");
  const v = validateConfig(b);
  if (!v.ok) return bad(v.error);
  const current = await getConfig();
  // Réactiver ou changer l'heure permet un nouvel envoi dès aujourd'hui.
  const reset = !current.enabled || current.time !== v.value.time;
  const next = { ...current, ...v.value, lastError: "", ...(reset ? { lastSentOn: "" } : {}) };
  await saveConfig(next);
  return NextResponse.json(next);
}

// Liste des appareils (sans leurs adresses d'abonnement).
export async function GET() {
  const devices = await prisma.pushSub.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, label: true, createdAt: true } });
  return NextResponse.json({ config: await getConfig(), devices });
}
