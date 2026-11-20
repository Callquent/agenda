const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Appel JSON vers l'API de l'agenda ; lève une erreur lisible si le serveur refuse. */
export async function api<T = unknown>(path: string, method = "GET", data?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: data === undefined ? undefined : { "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
  return json as T;
}

export const PALETTE = ["#2f6fed", "#3f8f5a", "#c47a2c", "#c2417c", "#7c5cd6", "#0e8f9f", "#d92d3a", "#667085"];
