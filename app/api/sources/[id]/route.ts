import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, body, COLOR, str } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const b = await body(req);
  if (!b) return bad("Données invalides");
  const data: { name?: string; color?: string; enabled?: boolean } = {};
  if ("name" in b) {
    const name = str(b.name, 80);
    if (!name) return bad("Le nom est obligatoire.");
    data.name = name;
  }
  if ("color" in b && typeof b.color === "string" && COLOR.test(b.color)) data.color = b.color;
  if ("enabled" in b) data.enabled = b.enabled === true;
  try {
    return NextResponse.json(await prisma.source.update({ where: { id }, data }));
  } catch {
    return bad("Application introuvable.", 404);
  }
}

/** Délier : les dates importées de cette application disparaissent de l'agenda (suppression en cascade). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.source.delete({ where: { id } });
  } catch {
    return bad("Application introuvable.", 404);
  }
  return NextResponse.json({ ok: true });
}
