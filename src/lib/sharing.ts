import type { Group, Movie } from "./types";

// Movies shared with everyone live in /movies; private and group-only ones live in /restricted.
export type Collection = "movies" | "restricted";

export const collectionFor = (sharedWith: string): Collection => (sharedWith === "all" ? "movies" : "restricted");

export const groupIdOf = (sharedWith: string): string | null =>
  sharedWith.startsWith("group:") ? sharedWith.slice("group:".length) : null;

export function sharingLabel(sharedWith: string, groups: Pick<Group, "id" | "name">[]): string | null {
  if (sharedWith === "all") return null;
  if (sharedWith === "me") return "Only you";
  const group = groups.find((g) => g.id === groupIdOf(sharedWith));
  return group ? group.name : "Only you (group removed)";
}

// Only the person who added a movie decides who it's shared with.
export function canChangeSharing(m: Pick<Movie, "shared_with" | "owner" | "added_by">, me: string): boolean {
  return m.shared_with === "all" ? (m.added_by ?? "").toLowerCase() === me : m.owner === me;
}

// The fields to store for a movie, given who it should be shared with.
export function storedFields(m: Movie, sharedWith: string, me: string): Record<string, unknown> {
  const { id: _id, shared_with: _sharedWith, owner, ...rest } = m;
  if (sharedWith === "all") return rest;
  return { ...rest, owner: owner ?? me, group_id: groupIdOf(sharedWith) };
}

// One list from several queries (everyone's movies, mine, each group's), newest first.
export function mergeMovieLists(lists: Movie[][]): Movie[] {
  const byId = new Map<string, Movie>();
  for (const list of lists) for (const m of list) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
