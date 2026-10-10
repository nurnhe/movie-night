import { titleKey } from "./media";
import type { SearchResult } from "./tmdb";
import type { MediaType, Movie } from "./types";

export const MAX_STARS = 5;

// Ratings go in half-star steps: 0.5, 1, 1.5 ... 5.
export const isStars = (x: unknown): x is number => typeof x === "number" && x >= 0.5 && x <= MAX_STARS && Number.isInteger(x * 2);
export const formatStars = (stars: number) => String(stars);

export function normalizeRatings(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [email, stars] of Object.entries(raw)) {
    if (isStars(stars)) out[email] = stars;
  }
  return out;
}

export interface RatedSource {
  media_type: MediaType;
  tmdb_id: number;
  title: string;
  stars: number;
}

// The titles whose TMDB recommendations shape my suggestions: my favourites, plus a few I disliked.
export function pickSources(movies: Pick<Movie, "media_type" | "tmdb_id" | "title" | "ratings" | "watched_at">[], me: string): RatedSource[] {
  const rated = movies
    .filter((m) => m.tmdb_id != null && m.ratings[me] != null)
    .map((m) => ({ media_type: m.media_type, tmdb_id: m.tmdb_id as number, title: m.title, stars: m.ratings[me], watched_at: m.watched_at ?? "" }))
    .sort((a, b) => b.stars - a.stars || b.watched_at.localeCompare(a.watched_at));
  const liked = rated.filter((r) => r.stars >= 4).slice(0, 5);
  const disliked = rated.filter((r) => r.stars <= 2).reverse().slice(0, 3);
  return [...liked, ...disliked].map(({ media_type, tmdb_id, title, stars }) => ({ media_type, tmdb_id, title, stars }));
}

export interface Suggestion extends SearchResult {
  because: string[];
  score: number;
}

// 5 stars pulls a title's recommendations up the most, 1 star pushes them down; 3 stars is neutral.
// `exclude` holds titleKey()s of what's already on the list.
export function rankSuggestions(sources: (RatedSource & { results: SearchResult[] })[], exclude: Set<string>, limit = 12): Suggestion[] {
  const byKey = new Map<string, Suggestion & { best: number }>();
  for (const source of sources) {
    const weight = source.stars - 3;
    if (!weight) continue;
    source.results.forEach((r, i) => {
      const key = titleKey(r.media_type, r.id);
      if (exclude.has(key)) return;
      const contribution = weight * (1 - i / (source.results.length + 1));
      const s = byKey.get(key) ?? { ...r, because: [], score: 0, best: 0 };
      s.score += contribution;
      if (contribution > 0 && !s.because.includes(source.title)) {
        s.because = contribution > s.best ? [source.title, ...s.because] : [...s.because, source.title];
        s.best = Math.max(s.best, contribution);
      }
      byKey.set(key, s);
    });
  }
  return [...byKey.values()]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, limit)
    .map(({ best: _best, ...s }) => s);
}
