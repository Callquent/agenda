import { prisma } from "@/lib/prisma";
import { hubApps, hubUrl } from "@/lib/hub";
import { PRESETS, publicBase } from "@/lib/sources";
import LinkApp from "@/components/LinkApp";
import SourceCard from "@/components/SourceCard";

export const dynamic = "force-dynamic";

const ago = (d: Date | null) => {
  if (!d) return "";
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 1440) return `il y a ${Math.round(min / 60)} h`;
  return `le ${d.toLocaleDateString("fr-FR")}`;
};

export default async function Applications() {
  const [sources, apps, hub, counts] = await Promise.all([
    prisma.source.findMany({ orderBy: { createdAt: "asc" } }),
    hubApps(),
    hubUrl(),
    prisma.event.groupBy({ by: ["sourceId"], _count: { _all: true } }),
  ]);
  const count = new Map(counts.map((c) => [c.sourceId, c._count._all]));

  return (
    <>
      <h1>Applications liées</h1>
      <p className="muted" style={{ margin: 0 }}>
        Quand une application est liée, ses dates (arrosages, tâches…) s'ajoutent à l'agenda et restent à jour.
        Délier une application retire ses dates de l'agenda.
      </p>
      <LinkApp presets={[...PRESETS]} hubIds={apps.map((a) => a.id).filter((id) => id !== "agenda")} hubFound={!!hub} />
      {sources.length === 0 ? (
        <p className="panel muted">Aucune application liée pour le moment.</p>
      ) : (
        sources.map((s) => (
          <SourceCard
            key={s.id}
            id={s.id}
            name={s.name}
            color={s.color}
            enabled={s.enabled}
            target={publicBase(s)}
            count={count.get(s.id) ?? 0}
            lastSync={ago(s.lastSyncAt)}
            lastError={s.lastError}
          />
        ))
      )}
    </>
  );
}
