import type { Movie, Person } from "./types";

export const MAX_MEMBERS = 20;
export const MAX_GROUP_NAME = 60;
export const MAX_NAME_LENGTH = 40; // matches the limit in firestore.rules

export function normalizeEmail(text: string): string | null {
  const email = text.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
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

export function mergePeople(directory: Person[], moreEmails: (string | null | undefined)[]): Person[] {
  const byEmail = new Map<string, Person>();
  for (const p of directory) {
    const email = p.email.trim().toLowerCase();
    if (email) byEmail.set(email, { email, name: p.name.trim() });
  }
  for (const raw of moreEmails) {
    const email = raw?.trim().toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, { email, name: "" });
  }
  return [...byEmail.values()].sort((a, b) => personLabel(a).localeCompare(personLabel(b)));
}

export const personLabel = (p: Person) => (p.name ? `${p.name} (${p.email})` : p.email);

// For everyday display (cards, ratings, headers): just the name, falling back to the
// part of the email before the @ when nobody has set one yet.
export function displayName(email: string | null | undefined, people: Person[]): string {
  if (!email) return "";
  const key = email.trim().toLowerCase();
  const person = people.find((p) => p.email === key);
  const name = person?.name.trim();
  return name || key.split("@")[0];
}
