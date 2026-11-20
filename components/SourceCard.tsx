"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

type Props = { id: string; name: string; color: string; enabled: boolean; target: string; count: number; lastSync: string; lastError: string };

export default function SourceCard(s: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(s.lastError);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="panel source" style={{ ["--c" as string]: s.color }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{s.name}</h2>
        <span className="badge">{s.enabled ? "Affichée" : "Masquée"}</span>
      </div>
      <span className="muted">
        {s.target} · {s.count} date{s.count > 1 ? "s" : ""} · {s.lastSync ? `synchronisée ${s.lastSync}` : "jamais synchronisée"}
      </span>
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn small" disabled={busy} onClick={() => run(() => api(`/api/sources/${s.id}/sync`, "POST"))}>
          Synchroniser
        </button>
        <button className="btn quiet small" disabled={busy} onClick={() => run(() => api(`/api/sources/${s.id}`, "PATCH", { enabled: !s.enabled }))}>
          {s.enabled ? "Masquer" : "Afficher"}
        </button>
        <button
          className="btn danger small"
          disabled={busy}
          onClick={() => {
            if (confirm(`Délier « ${s.name} » ? Ses dates disparaîtront de l'agenda (l'application, elle, n'est pas touchée).`)) {
              run(() => api(`/api/sources/${s.id}`, "DELETE"));
            }
          }}
        >
          Délier
        </button>
      </div>
    </div>
  );
}
