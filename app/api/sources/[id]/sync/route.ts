import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad } from "@/lib/api";
import { defaultWindow, forgetSync, syncSource } from "@/lib/sources";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) return bad("Application introuvable.", 404);
  forgetSync(id);
  const { from, to } = defaultWindow();
  const r = await syncSource(source, from, to);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
