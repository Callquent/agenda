import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidDate, ISO_TIME } from "@/lib/dates";
import { bad, body, COLOR, str } from "@/lib/api";
import { isRecurring, parseRepeat, toggleDone } from "@/lib/recur";

type Ctx = { params: Promise<{ id: string }> };

// Seuls les événements créés dans l'agenda se modifient ici : ceux des applications liées
// se modifient dans leur application (ils sont réimportés à chaque synchronisation).
async function manual(id: string) {
  const ev = await prisma.event.findUnique({ where: { id } });
  return ev && ev.sourceId === null ? ev : null;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const current = await manual(id);
  if (!current) return bad("Événement introuvable ou géré par une autre application.", 404);
  const b = await body(req);
  if (!b) return bad("Données invalides");

  const data: Record<string, string | number> = {};
  // Série répétée : « fait » se coche jour par jour.
  if ("toggleDone" in b) {
    if (!isRecurring(current) || !isValidDate(b.toggleDone)) return bad("Jour invalide.");
    return NextResponse.json(await prisma.event.update({ where: { id }, data: { doneOn: toggleDone(current.doneOn, b.toggleDone) } }));
  }
  if ("title" in b) {
    const title = str(b.title, 200);
    if (!title) return bad("Le titre est obligatoire.");
    data.title = title;
  }
  if ("date" in b) {
    if (!isValidDate(b.date)) return bad("Date invalide.");
    data.date = b.date;
  }
  let repeating = isRecurring(current);
  if ("repeatMode" in b) {
    const rep = parseRepeat(b, String(data.date ?? current.date));
    if (!rep.ok) return bad(rep.error);
    Object.assign(data, rep.value);
    repeating = rep.value.repeatEvery > 0 || rep.value.repeatDays !== "";
  }
  if ("endDate" in b || "date" in b || "repeatMode" in b) {
    const date = String(data.date ?? current.date);
    const end = "endDate" in b ? b.endDate : current.endDate;
    // Un événement répété n'a pas de fin « sur plusieurs jours » (sa fin est repeatUntil).
    data.endDate = !repeating && isValidDate(end) && end > date ? end : "";
  }
  if ("time" in b) data.time = typeof b.time === "string" && ISO_TIME.test(b.time) ? b.time : "";
  if ("notes" in b) data.notes = str(b.notes, 2000);
  if ("color" in b) data.color = typeof b.color === "string" && COLOR.test(b.color) ? b.color : "";
  if ("status" in b && !isRecurring(current)) data.status = b.status === "done" ? "done" : "todo";

  return NextResponse.json(await prisma.event.update({ where: { id }, data }));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!(await manual(id))) return bad("Événement introuvable ou géré par une autre application.", 404);
  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
