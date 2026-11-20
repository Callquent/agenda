"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, PALETTE } from "@/lib/client";
import { daysOf, WEEKDAY_ORDER, WEEKDAY_SHORT } from "@/lib/recur";

type Mode = "none" | "every" | "weekdays";
const MODES: { key: Mode; label: string }[] = [
  { key: "none", label: "Une fois" },
  { key: "every", label: "Tous les X jours" },
  { key: "weekdays", label: "Jours de la semaine" },
];

export type EditableEvent = {
  id: string;
  title: string;
  start: string;
  endDate: string;
  time: string;
  notes: string;
  color: string;
  repeatEvery: number;
  repeatDays: string;
  repeatUntil: string;
};

/** Formulaire d'un événement de l'agenda : création (sans `initial`) ou modification (avec `initial`). */
export default function EventForm({ date, initial, onClose }: { date: string; initial?: EditableEvent; onClose: () => void }) {
  const router = useRouter();
  const startMode: Mode = initial ? (initial.repeatEvery > 0 ? "every" : daysOf(initial.repeatDays).length > 0 ? "weekdays" : "none") : "none";
  const [color, setColor] = useState(initial?.color || PALETTE[0]);
  const [mode, setMode] = useState<Mode>(startMode);
  const [every, setEvery] = useState(initial && initial.repeatEvery > 0 ? initial.repeatEvery : 7);
  const [days, setDays] = useState<number[]>(initial ? daysOf(initial.repeatDays) : []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // « Jusqu'au » = fin de l'événement (sur plusieurs jours) ou fin de la répétition, selon le mode
  const until = initial ? (startMode === "none" ? initial.endDate : initial.repeatUntil) : "";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const payload = {
        title: f.get("title"),
        date: f.get("date"),
        time: f.get("time"),
        notes: f.get("notes"),
        color,
        ...(mode === "none"
          ? { repeatMode: "none", endDate: f.get("endDate") }
          : { repeatMode: mode, repeatEvery: every, repeatDays: days, repeatUntil: f.get("endDate") }),
      };
      await api(initial ? `/api/events/${initial.id}` : "/api/events", initial ? "PATCH" : "POST", payload);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    // key : le formulaire se réinitialise quand on change de jour
    <form key={initial?.id ?? date} onSubmit={submit} className="panel day">
      <label>
        Titre
        <input name="title" required maxLength={200} autoFocus defaultValue={initial?.title ?? ""} />
      </label>
      <div className="grid2">
        <label>
          {mode === "none" ? "Date" : "Début"}
          <input name="date" type="date" required defaultValue={initial?.start ?? date} />
        </label>
        <label>
          Heure (facultatif)
          <input name="time" type="time" defaultValue={initial?.time ?? ""} />
        </label>
        <label>
          {mode === "none" ? "Jusqu'au (facultatif)" : "Répéter jusqu'au (facultatif)"}
          <input name="endDate" type="date" defaultValue={until} />
        </label>
      </div>
      <div className="day" style={{ gap: 8 }}>
        <div className="seg" role="group" aria-label="Répétition">
          {MODES.map((m) => (
            <button key={m.key} type="button" aria-pressed={mode === m.key} onClick={() => setMode(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
        {mode === "every" && (
          <label style={{ maxWidth: 220 }}>
            Tous les combien de jours ?
            <input type="number" min={1} max={365} required value={every} onChange={(e) => setEvery(Number(e.target.value))} />
          </label>
        )}
        {mode === "weekdays" && (
          <div className="seg" role="group" aria-label="Jours de la semaine">
            {WEEKDAY_ORDER.map((d) => (
              <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))}>
                {WEEKDAY_SHORT[d]}
              </button>
            ))}
          </div>
        )}
        {mode !== "none" && <span className="muted">À partir de la date de début.</span>}
      </div>
      <label>
        Notes
        <textarea name="notes" rows={2} maxLength={2000} defaultValue={initial?.notes ?? ""} />
      </label>
      <div className="swatches" role="group" aria-label="Couleur">
        {PALETTE.map((c) => (
          <button key={c} type="button" className="swatch" style={{ ["--c" as string]: c }} aria-pressed={c === color} aria-label={c} onClick={() => setColor(c)} />
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn" disabled={busy}>{initial ? "Enregistrer les modifications" : "Enregistrer"}</button>
        <button type="button" className="btn quiet" onClick={onClose}>Annuler</button>
      </div>
    </form>
  );
}
