import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PRESETS } from "@/lib/sources";

export const dynamic = "force-dynamic";

/**
 * Liens de l'agenda avec les autres applications, lus par la page « Liens » de MaPetiteBoîte.
 * Chaque application liée fournit ses dates à l'agenda : direction « in » (l'agenda reçoit).
 */
export async function GET() {
  const sources = await prisma.source.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
  const links = sources.map((s) => {
    const hint = PRESETS.find((p) => p.appId === s.appId)?.hint;
    const label = hint ?? "Dates affichées dans l'agenda";
    return s.appId ? { app: s.appId, label, direction: "in" } : { name: s.name, label, direction: "in" };
  });
  return NextResponse.json({ links });
}
