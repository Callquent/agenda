"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import type { AgendaEvent } from "@/lib/events";
import EventForm from "./EventForm";

export default function ManualActions({ ev }: { ev: AgendaEvent }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const done = ev.status === "done";

  async function run(method: "PATCH" | "DELETE") {
    if (method === "DELETE" && !confirm(ev.recurring ? "Supprimer toute la série (tous les jours) ?" : "Supprimer cet événement ?")) return;
    setBusy(true);
    try {
      // Série répétée : « fait » se coche pour le jour affiché seulement.
      await api(`/api/events/${ev.id}`, method, method === "PATCH" ? (ev.recurring ? { toggleDone: ev.date } : { status: done ? "todo" : "done" }) : undefined);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <span className="row">
        <button className="btn quiet small" disabled={busy} onClick={() => run("PATCH")}>
          {done ? "Rouvrir" : "Fait"}
        </button>
        <button className="btn quiet small" disabled={busy} onClick={() => setEditing((v) => !v)}>
          Modifier
        </button>
        <button className="btn danger small" disabled={busy} onClick={() => run("DELETE")}>
          {ev.recurring ? "Supprimer la série" : "Supprimer"}
        </button>
      </span>
      {editing && <EventForm date={ev.date} initial={ev} onClose={() => setEditing(false)} />}
    </>
  );
}
