import type { MediaType, Movie } from "./types";

export type Kind = "movie" | "tv" | "anime";
export type Status = "todo" | "watching" | "done";

export const KIND_LABELS: Record<Kind, string> = { movie: "Movie", tv: "TV show", anime: "Anime" };

const ANIMATION_GENRE_ID = 16;

// TMDB has no anime genre. Anime is Japanese-language animation, whether it's a series or a film.
export function isAnime(genreIds: number[], originalLanguage: string | null | undefined): boolean {
  return genreIds.includes(ANIMATION_GENRE_ID) && originalLanguage === "ja";
}

export const kindOf = (m: Pick<Movie, "media_type" | "anime">): Kind => (m.anime ? "anime" : m.media_type);

export const statusOf = (m: Pick<Movie, "watched" | "watching">): Status => (m.watched ? "done" : m.watching ? "watching" : "todo");

// The fields that change when a title moves between To watch, Watching and Watched.
// Watched and watching are never both set.
export function statusPatch(status: Status, now: string): Pick<Movie, "watched" | "watching" | "watched_at"> {
  return { watched: status === "done", watching: status === "watching", watched_at: status === "done" ? now : null };
}

// TMDB numbers movies and TV shows separately, so an id alone doesn't identify a title.
export const titleKey = (mediaType: MediaType, tmdbId: number) => `${mediaType}:${tmdbId}`;

// TMDB's TV genres bundle two ("Sci-Fi & Fantasy") and its movie genre is spelled "Science Fiction".
// Split and rename them so the same tag means the same thing across movies and TV.
const GENRE_RENAMES: Record<string, string[]> = {
  "Science Fiction": ["Sci-Fi"],
  "Sci-Fi & Fantasy": ["Sci-Fi", "Fantasy"],
  "Action & Adventure": ["Action", "Adventure"],
  "War & Politics": ["War", "Politics"],
};

export function normalizeGenres(names: string[]): string[] {
  return [...new Set(names.flatMap((n) => GENRE_RENAMES[n] ?? [n]))];
}

export function seriesStatusLabel(status: string | null): string | null {
  switch (status) {
    case "Returning Series": return "Airing";
    case "Ended": return "Ended";
    case "Canceled": return "Canceled";
    case "In Production": case "Planned": case "Pilot": return "Coming soon";
    default: return null;
  }
}

export function seriesSize(seasons: number | null, episodes: number | null): string {
  const parts: string[] = [];
  if (seasons) parts.push(`${seasons} season${seasons === 1 ? "" : "s"}`);
  if (episodes) parts.push(`${episodes} episode${episodes === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
