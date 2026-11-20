import { runDaily } from "./notify";

const g = globalThis as typeof globalThis & { __agendaScheduler?: boolean };

/** Vérifie chaque minute s'il faut envoyer la notification du jour (une seule minuterie par processus). */
export function startScheduler() {
  if (g.__agendaScheduler) return;
  g.__agendaScheduler = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runDaily();
    } catch (e) {
      console.error("[agenda] notifications :", e);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 20_000); // rattrapage rapide au démarrage de l'application
  setInterval(tick, 60_000);
}
