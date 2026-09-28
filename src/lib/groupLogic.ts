import type { Movie } from "./types";

export const MAX_MEMBERS = 20;
export const MAX_GROUP_NAME = 60;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const parts = text.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) (EMAIL.test(p) ? valid : invalid).push(p);
  return { valid: [...new Set(valid)], invalid };
}

export function applyMemberChanges(current: string[], added: string[], removed: string[]): string[] {
  const gone = new Set(removed);
  return [...new Set([...current.filter((e) => !gone.has(e)), ...added])];
}

type Keyed = Pick<Movie, "tmdb_id" | "title">;

const movieKey = (m: Keyed) => (m.tmdb_id != null ? `tmdb:${m.tmdb_id}` : `title:${m.title.trim().toLowerCase()}`);

export function newMoviesOnly<T extends Keyed>(existing: Keyed[], incoming: T[]): T[] {
  const seen = new Set(existing.map(movieKey));
  return incoming.filter((m) => {
    const key = movieKey(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
