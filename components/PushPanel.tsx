"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Device = { id: string; label: string; createdAt: string };
type Support = "checking" | "ok" | "insecure" | "unsupported" | "ios-home";

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Appareil";
  const nav = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "navigateur";
  return `${os} · ${nav}`;
}

function toKey(b64: string): Uint8Array<ArrayBuffer> {
  const raw = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushPanel({ enabled: initialEnabled, time: initialTime, devices }: { enabled: boolean; time: string; devices: Device[] }) {
  const router = useRouter();
  const [support, setSupport] = useState<Support>("checking");
  const [here, setHere] = useState(false); // cet appareil est-il déjà abonné ?
  const [enabled, setEnabled] = useState(initialEnabled);
  const [time, setTime] = useState(initialTime);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [secureUrl, setSecureUrl] = useState("");
  const [certUrl, setCertUrl] = useState("");

  useEffect(() => {
    setSecureUrl(`https://${location.host}${BASE}/notifications`);
    setCertUrl(`${location.origin}/hors-ligne`);
    if (!window.isSecureContext) return setSupport("insecure");
    const ios = /iPhone|iPad/.test(navigator.userAgent);
    const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return setSupport(ios && !standalone ? "ios-home" : "unsupported");
    }
    setSupport("ok");
    navigator.serviceWorker
      .getRegistration(`${BASE}/`)
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setHere(!!sub))
      .catch(() => undefined);
  }, []);

  async function run<T>(kind: string, fn: () => Promise<T>, ok: (r: T) => string) {
    setBusy(kind);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ ok: true, text: ok(r) });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setBusy("");
    }
  }

  const activate = () =>
    run("on", async () => {
      const reg = await navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` });
      await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== "granted") {
        throw new Error("Notifications refusées : autorisez-les pour ce site dans les réglages du navigateur, puis réessayez.");
      }
      const { publicKey } = await api<{ publicKey: string }>("/api/push/subscribe");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
      await api("/api/push/subscribe", "POST", { subscription: sub.toJSON(), label: deviceLabel() });
      setHere(true);
    }, () => "Notifications activées sur cet appareil.");

  const deactivate = () =>
    run("off", async () => {
      const reg = await navigator.serviceWorker.getRegistration(`${BASE}/`);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/push/subscribe", "DELETE", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setHere(false);
    }, () => "Notifications désactivées sur cet appareil.");

  const save = () => run("save", () => api("/api/notifications", "PUT", { enabled, time }), () => "Réglages enregistrés.");
  const test = () =>
    run("test", () => api<{ sent: number; devices: number }>("/api/notifications/test", "POST"), (r) => `Test envoyé à ${r.sent} appareil${r.sent > 1 ? "s" : ""} sur ${r.devices}.`);
  const remove = (id: string) => run("rm", () => api("/api/push/subscribe", "DELETE", { id }), () => "Appareil retiré.");

  return (
    <>
      <div className="panel day">
        <h2>Cet appareil</h2>
        {support === "checking" && <p className="muted">Vérification…</p>}
        {support === "insecure" && (
          <>
            <p style={{ margin: 0 }}>
              Les notifications du navigateur exigent une connexion sécurisée (https). Deux étapes, une seule fois :
            </p>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li>
                Installez le certificat du PC sur ce téléphone : <a href={certUrl}>page « Copie sur le téléphone » de MaPetiteBoîte</a> (suivez l'étape « Installez le certificat »).
              </li>
              <li>
                Rouvrez cette page en version sécurisée : <a href={secureUrl}>{secureUrl}</a>
              </li>
            </ol>
          </>
        )}
        {support === "ios-home" && (
          <p style={{ margin: 0 }}>
            Sur iPhone, ajoutez d'abord l'agenda à l'écran d'accueil (bouton Partager, puis « Sur l'écran d'accueil »), ouvrez-le depuis cette icône, puis revenez sur cette page. Il faut iOS 16.4 ou plus.
          </p>
        )}
        {support === "unsupported" && <p style={{ margin: 0 }}>Ce navigateur ne permet pas les notifications. Essayez Chrome, Firefox, Edge ou Safari récent.</p>}
        {support === "ok" && (
          <div className="row">
            {here ? (
              <>
                <span className="badge">Activées sur cet appareil</span>
                <button className="btn quiet small" disabled={!!busy} onClick={deactivate}>Désactiver</button>
              </>
            ) : (
              <button className="btn" disabled={!!busy} onClick={activate}>{busy === "on" ? "Activation…" : "Activer les notifications ici"}</button>
            )}
          </div>
        )}
      </div>

      <form className="panel day" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h2>Envoi quotidien</h2>
        <label style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--ink)" }}>
          <input type="checkbox" style={{ width: "auto" }} checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Recevoir chaque jour la liste des tâches du jour
        </label>
        <label style={{ maxWidth: 200 }}>
          Heure d'envoi
          <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <div className="row">
          <button className="btn" disabled={!!busy}>{busy === "save" ? "Enregistrement…" : "Enregistrer"}</button>
          <button type="button" className="btn quiet" disabled={!!busy} onClick={test}>{busy === "test" ? "Envoi…" : "Envoyer un test"}</button>
        </div>
      </form>

      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}

      {devices.length > 0 && (
        <div className="panel day">
          <h2>Appareils activés</h2>
          {devices.map((d) => (
            <div key={d.id} className="row" style={{ justifyContent: "space-between" }}>
              <span>{d.label || "Appareil"} <span className="muted">· depuis le {new Date(d.createdAt).toLocaleDateString("fr-FR")}</span></span>
              <button className="btn danger small" disabled={!!busy} onClick={() => remove(d.id)}>Retirer</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
