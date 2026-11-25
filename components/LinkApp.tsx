"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, PALETTE } from "@/lib/client";

type Preset = { key: string; name: string; appId: string; match: string; color: string; hint: string };

export default function LinkApp({ presets, hubIds, hubFound }: { presets: Preset[]; hubIds: string[]; hubFound: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(presets[0].key);
  const preset = presets.find((p) => p.key === choice);
  // Identifiant réellement installé dans « Triviae » (ex. taches-menageres), sinon celui par défaut
  const presetId = preset ? (hubIds.find((id) => id.includes(preset.match)) ?? preset.appId) : "";
  const [color, setColor] = useState(presets[0].color);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  function pick(key: string) {
    setChoice(key);
    const p = presets.find((x) => x.key === key);
    if (p) setColor(p.color);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setDone("");
    try {
      const r = await api<{ count: number }>("/api/sources", "POST", {
        name: f.get("name"),
        appId: f.get("appId"),
        customUrl: f.get("customUrl"),
        color,
      });
      setDone(`Application liée : ${r.count} date${r.count > 1 ? "s" : ""} ajoutée${r.count > 1 ? "s" : ""} à l'agenda.`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="row">
        <button className="btn" onClick={() => setOpen(true)}>+ Lier une application</button>
        {done && <span className="ok">{done}</span>}
      </div>
    );
  }
  return (
    <form key={choice} onSubmit={submit} className="panel day">
      <h2>Lier une application</h2>
      <label>
        Application
        <select value={choice} onChange={(e) => pick(e.target.value)}>
          {presets.map((p) => (
            <option key={p.key} value={p.key}>{p.name} — {p.hint}</option>
          ))}
          <option value="autre">Autre application…</option>
        </select>
      </label>
      <div className="grid2">
        <label>
          Nom dans l'agenda
          <input name="name" required maxLength={80} defaultValue={preset?.name ?? ""} />
        </label>
        <label>
          Identifiant dans « Triviae »
          <input name="appId" list="hub-ids" defaultValue={presetId} placeholder="ex. plantes" autoCapitalize="none" />
          <datalist id="hub-ids">{hubIds.map((id) => <option key={id} value={id} />)}</datalist>
        </label>
        {choice === "autre" && (
          <label>
            …ou adresse complète
            <input name="customUrl" placeholder="http://192.168.1.20:3000" />
          </label>
        )}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {hubFound
          ? hubIds.length
            ? `Applications trouvées dans Triviae : ${hubIds.join(", ")}.`
            : "Aucune application installée dans Triviae."
          : "« Triviae » n'a pas été trouvé depuis l'agenda : utilisez une adresse complète."}
      </p>
      <div className="swatches" role="group" aria-label="Couleur">
        {PALETTE.map((c) => (
          <button key={c} type="button" className="swatch" style={{ ["--c" as string]: c }} aria-pressed={c === color} aria-label={c} onClick={() => setColor(c)} />
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn" disabled={busy}>{busy ? "Vérification…" : "Lier"}</button>
        <button type="button" className="btn quiet" onClick={() => setOpen(false)}>Annuler</button>
      </div>
    </form>
  );
}
