import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidDate, ISO_TIME } from "@/lib/dates";
import { bad, body, COLOR, str } from "@/lib/api";
import { parseRepeat } from "@/lib/recur";

export async function POST(req: Request) {
  const b = await body(req);
  if (!b) return bad("Données invalides");
  const title = str(b.title, 200);
  if (!title) return bad("Le titre est obligatoire.");
  if (!isValidDate(b.date)) return bad("Date invalide.");
  const rep = parseRepeat(b, b.date);
  if (!rep.ok) return bad(rep.error);
  const repeating = rep.value.repeatEvery > 0 || rep.value.repeatDays !== "";
  // Un événement répété n'a pas de « fin sur plusieurs jours » : sa date de fin est repeatUntil.
  const endDate = !repeating && isValidDate(b.endDate) && b.endDate > b.date ? b.endDate : "";
  const time = typeof b.time === "string" && ISO_TIME.test(b.time) ? b.time : "";
  const color = typeof b.color === "string" && COLOR.test(b.color) ? b.color : "";
  const event = await prisma.event.create({
    data: { title, date: b.date, endDate, time, color, notes: str(b.notes, 2000), ...rep.value },
  });
  return NextResponse.json(event, { status: 201 });
}
