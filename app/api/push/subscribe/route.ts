import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, body, str } from "@/lib/api";
import { publicKey } from "@/lib/notify";
import { validateSubscription } from "@/lib/notify-core";

// Clé publique du serveur : le navigateur en a besoin pour créer l'abonnement.
export async function GET() {
  return NextResponse.json({ publicKey: await publicKey() });
}

export async function POST(req: Request) {
  const b = await body(req);
  if (!b) return bad("Données invalides");
  const v = validateSubscription(b.subscription);
  if (!v.ok) return bad(v.error);
  const label = str(b.label, 80);
  const sub = await prisma.pushSub.upsert({
    where: { endpoint: v.value.endpoint },
    create: { ...v.value, label },
    update: { p256dh: v.value.p256dh, auth: v.value.auth, label },
  });
  return NextResponse.json({ id: sub.id }, { status: 201 });
}

// Retire un appareil (par identifiant depuis la liste, ou par adresse quand l'appareil se désactive lui-même).
export async function DELETE(req: Request) {
  const b = await body(req);
  if (!b) return bad("Données invalides");
  const where = typeof b.id === "string" ? { id: b.id } : typeof b.endpoint === "string" ? { endpoint: b.endpoint } : null;
  if (!where) return bad("Appareil non précisé.");
  await prisma.pushSub.deleteMany({ where });
  return NextResponse.json({ ok: true });
}
