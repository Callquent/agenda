import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, body, COLOR, str } from "@/lib/api";
import { defaultWindow, fetchFeed, syncSource } from "@/lib/sources";

export async function GET() {
  return NextResponse.json(await prisma.source.findMany({ orderBy: { createdAt: "asc" } }));
}

/** Lier une application : on vérifie d'abord qu'elle fournit bien ses dates, puis on les importe. */
export async function POST(req: Request) {
  const b = await body(req);
  if (!b) return bad("Données invalides");
  const name = str(b.name, 80);
  const appId = str(b.appId, 41).toLowerCase();
  const customUrl = str(b.customUrl, 300);
  if (!name) return bad("Le nom est obligatoire.");
  if (appId && !/^[a-z0-9][a-z0-9-]*$/.test(appId)) return bad("Identifiant invalide (minuscules, chiffres et tirets).");
  if (!appId && !/^https?:\/\/[^\s]+$/.test(customUrl)) return bad("Indiquez l'identifiant de l'application ou son adresse complète (http://…).");
  const color = typeof b.color === "string" && COLOR.test(b.color) ? b.color : "#3b82f6";

  const duplicate = await prisma.source.findFirst({ where: appId ? { appId } : { customUrl } });
  if (duplicate) return bad("Cette application est déjà liée à l'agenda.", 409);

  const draft = { appId, customUrl: appId ? "" : customUrl, feedPath: "/api/agenda" };
  const { from, to } = defaultWindow();
  try {
    await fetchFeed(draft, from, to);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Application injoignable.", 422);
  }
  const source = await prisma.source.create({ data: { name, color, ...draft } });
  const sync = await syncSource(source, from, to);
  return NextResponse.json({ source, count: sync.count }, { status: 201 });
}
