import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/notify";
import PushPanel from "@/components/PushPanel";

export const dynamic = "force-dynamic";

export default async function Notifications() {
  const [cfg, devices] = await Promise.all([
    getConfig(),
    prisma.pushSub.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, label: true, createdAt: true } }),
  ]);
  return (
    <>
      <h1>Notifications du téléphone</h1>
      <p className="muted" style={{ margin: 0 }}>
        Chaque jour à l'heure choisie, l'agenda envoie les tâches du jour (en retard et à faire ; rien si la journée est vide) sous forme de
        notification du navigateur, sans application à installer. Si le PC est éteint à cette heure, l'envoi part dès qu'il est rallumé, le même jour.
      </p>
      <PushPanel
        enabled={cfg.enabled}
        time={cfg.time}
        devices={devices.map((d: { id: string; label: string; createdAt: Date }) => ({ id: d.id, label: d.label, createdAt: d.createdAt.toISOString() }))}
      />
      {cfg.enabled && (
        <p className="muted">{cfg.lastSentOn ? `Dernier envoi : le ${cfg.lastSentOn.split("-").reverse().join("/")}.` : "Aucun envoi pour l'instant."}</p>
      )}
      {cfg.lastError && <p className="panel err">Dernier envoi en échec : {cfg.lastError}</p>}
    </>
  );
}
