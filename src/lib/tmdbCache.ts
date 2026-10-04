import type { TitleDetails } from "./tmdb";
import type { Movie } from "./types";

// TMDB's API terms (section 1.C) forbid caching anything obtained from TMDB for longer than 6 months.
// Titles are stored in Firestore, so each one's TMDB-sourced fields are re-fetched once they're a month old.
export const REFRESH_AFTER_DAYS = 30;
// Only if TMDB no longer has a title can its data not be refreshed; past this age it has to go, well inside 6 months.
export const PURGE_AFTER_DAYS = 150;
// How many titles one visit refreshes, oldest first, so a long backlog doesn't hammer TMDB.
export const REFRESH_BATCH = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

type Aged = Pick<Movie, "tmdb_synced_at" | "created_at">;

// Titles added before the timestamp existed were fetched when they were added.
export function dataAgeDays(m: Aged, now: number): number {
  const fetchedAt = Date.parse(m.tmdb_synced_at ?? m.created_at);
  return Number.isFinite(fetchedAt) ? Math.max(0, Math.floor((now - fetchedAt) / DAY_MS)) : Infinity;
}

// Titles added by hand have no TMDB data to refresh.
export function staleTitles<T extends Aged & Pick<Movie, "tmdb_id">>(movies: T[], now: number, limit = REFRESH_BATCH): T[] {
  return movies
    .filter((m) => m.tmdb_id != null && dataAgeDays(m, now) >= REFRESH_AFTER_DAYS)
    .sort((a, b) => dataAgeDays(b, now) - dataAgeDays(a, now))
    .slice(0, limit);
}

export const mustPurge = (m: Aged, now: number) => dataAgeDays(m, now) >= PURGE_AFTER_DAYS;

// Only what TMDB supplied: never the note, tags, ratings, watched state or who it's shared with.
export function refreshPatch(details: TitleDetails, now: string) {
  return {
    anime: details.anime,
    imdb_id: details.imdb_id,
    title: details.title,
    year: details.year,
    runtime: details.runtime,
    seasons: details.seasons,
    episodes: details.episodes,
    series_status: details.series_status,
    genres: details.genres,
    rating: details.rating,
    vote_count: details.vote_count,
    poster_path: details.poster_path,
    overview: details.overview,
    tmdb_synced_at: now,
  };
}

// What's left of a title TMDB no longer has: its name and year, so the list entry still makes sense.
export const purgePatch = {
  imdb_id: null,
  runtime: null,
  seasons: null,
  episodes: null,
  series_status: null,
  genres: [] as string[],
  rating: null,
  vote_count: null,
  poster_path: null,
  overview: null,
};
