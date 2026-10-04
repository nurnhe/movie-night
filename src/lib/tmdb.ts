import { isAnime, normalizeGenres } from "./media";
import type { MediaType, Movie, NewMovie } from "./types";

const API = "https://api.themoviedb.org/3";
const token = import.meta.env.VITE_TMDB_TOKEN as string | undefined;

export const tmdbConfigured = Boolean(token);

export interface SearchResult {
  id: number;
  media_type: MediaType;
  anime: boolean;
  title: string;
  year: number | null;
  poster_path: string | null;
  rating: number | null;
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ language: "en-US", ...params });
  const res = await fetch(`${API}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB request failed (${res.status})`);
  return res.json() as Promise<T>;
}

function yearOf(date: string | undefined): number | null {
  const y = date ? parseInt(date.slice(0, 4), 10) : NaN;
  return Number.isFinite(y) ? y : null;
}

const scoreOf = (average: number | undefined, votes: number | undefined) =>
  votes ? Math.round((average ?? 0) * 10) / 10 : null;

interface RawResult {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  original_language?: string;
}

// Movies call it "title" and "release_date", TV shows "name" and "first_air_date".
function toResult(r: RawResult, mediaType: MediaType): SearchResult {
  const tv = mediaType === "tv";
  return {
    id: r.id,
    media_type: mediaType,
    anime: isAnime(r.genre_ids ?? [], r.original_language),
    title: (tv ? r.name : r.title) || r.title || r.name || "Untitled",
    year: yearOf(tv ? r.first_air_date : r.release_date),
    poster_path: r.poster_path,
    rating: scoreOf(r.vote_average, r.vote_count),
  };
}

// One search across movies and TV shows; people are dropped.
export async function searchTitles(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  if (signal?.aborted) return [];
  const data = await get<{ results: RawResult[] }>("/search/multi", { query, include_adult: "false" });
  return data.results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 10)
    .map((r) => toResult(r, r.media_type as MediaType));
}

export async function recommendations(id: number, mediaType: MediaType): Promise<SearchResult[]> {
  const data = await get<{ results: RawResult[] }>(`/${mediaType}/${id}/recommendations`);
  return data.results.map((r) => toResult(r, mediaType));
}

export type TitleDetails = Omit<NewMovie, "note" | "added_by" | "tags">;

interface Genre { id: number; name: string }

export async function titleDetails(id: number, mediaType: MediaType): Promise<TitleDetails> {
  return mediaType === "tv" ? tvDetails(id) : movieDetails(id);
}

async function movieDetails(id: number): Promise<TitleDetails> {
  const d = await get<{
    id: number; imdb_id: string | null; title: string; release_date?: string; runtime: number | null;
    genres: Genre[]; vote_average: number; vote_count: number; poster_path: string | null; overview: string;
    original_language?: string;
  }>(`/movie/${id}`);
  return {
    media_type: "movie",
    anime: isAnime(d.genres.map((g) => g.id), d.original_language),
    tmdb_id: d.id,
    imdb_id: d.imdb_id || null,
    title: d.title,
    year: yearOf(d.release_date),
    runtime: d.runtime || null,
    seasons: null,
    episodes: null,
    series_status: null,
    genres: normalizeGenres(d.genres.map((g) => g.name)),
    rating: scoreOf(d.vote_average, d.vote_count),
    vote_count: d.vote_count || null,
    poster_path: d.poster_path,
    overview: d.overview || null,
  };
}

async function tvDetails(id: number): Promise<TitleDetails> {
  const d = await get<{
    id: number; name: string; first_air_date?: string; episode_run_time?: number[];
    last_episode_to_air?: { runtime: number | null } | null; next_episode_to_air?: { runtime: number | null } | null;
    number_of_seasons?: number; number_of_episodes?: number; status?: string;
    genres: Genre[]; vote_average: number; vote_count: number; poster_path: string | null; overview: string;
    original_language?: string; external_ids?: { imdb_id: string | null };
  }>(`/tv/${id}`, { append_to_response: "external_ids" });
  return {
    media_type: "tv",
    anime: isAnime(d.genres.map((g) => g.id), d.original_language),
    tmdb_id: d.id,
    imdb_id: d.external_ids?.imdb_id || null,
    title: d.name,
    year: yearOf(d.first_air_date),
    // Newer shows often list no typical episode length, so fall back to a real episode's.
    runtime: d.episode_run_time?.[0] || d.last_episode_to_air?.runtime || d.next_episode_to_air?.runtime || null,
    seasons: d.number_of_seasons || null,
    episodes: d.number_of_episodes || null,
    series_status: d.status || null,
    genres: normalizeGenres(d.genres.map((g) => g.name)),
    rating: scoreOf(d.vote_average, d.vote_count),
    vote_count: d.vote_count || null,
    poster_path: d.poster_path,
    overview: d.overview || null,
  };
}

export const posterUrl = (path: string | null, size: "w92" | "w185" | "w342" = "w185") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

export const letterboxdUrl = (tmdbId: number) => `https://letterboxd.com/tmdb/${tmdbId}/`;
export const tmdbUrl = (tmdbId: number, mediaType: MediaType = "movie") => `https://www.themoviedb.org/${mediaType}/${tmdbId}`;
export const imdbUrl = (imdbId: string) => `https://www.imdb.com/title/${imdbId}/`;

// Letterboxd only covers films, so TV shows (and anime series) link to TMDB instead.
export function titleLinks(m: Pick<Movie, "tmdb_id" | "imdb_id" | "media_type">): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  if (m.tmdb_id) links.push(m.media_type === "movie" ? { label: "Letterboxd", url: letterboxdUrl(m.tmdb_id) } : { label: "TMDB", url: tmdbUrl(m.tmdb_id, "tv") });
  if (m.imdb_id) links.push({ label: "IMDb", url: imdbUrl(m.imdb_id) });
  return links;
}
