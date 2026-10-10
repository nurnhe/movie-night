import { describe, expect, it } from "vitest";
import { titleKey } from "./media";
import { formatStars, isStars, normalizeRatings, pickSources, rankSuggestions } from "./ratings";
import type { MediaType } from "./types";

const r = (id: number, rating: number | null = 7, media_type: MediaType = "movie") =>
  ({ id, media_type, anime: false, title: `Title ${id}`, year: 2020, poster_path: null, rating });

describe("normalizeRatings", () => {
  it("keeps whole and half-star ratings from 0.5 to 5 and drops everything else", () => {
    expect(normalizeRatings({ "a@x.io": 5, "b@x.io": 0, "c@x.io": 3.5, "d@x.io": "4", "e@x.io": 1, "f@x.io": 0.5, "g@x.io": 4.2, "h@x.io": 5.5, "i@x.io": NaN }))
      .toEqual({ "a@x.io": 5, "c@x.io": 3.5, "e@x.io": 1, "f@x.io": 0.5 });
  });
  it("recognises exactly the half-star steps", () => {
    expect([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].every(isStars)).toBe(true);
    expect([0, 0.25, 4.7, 5.5, -1, "4", null].some(isStars)).toBe(false);
    expect(formatStars(4.5)).toBe("4.5");
    expect(formatStars(4)).toBe("4");
  });
  it("treats missing or malformed values as no ratings", () => {
    expect(normalizeRatings(undefined)).toEqual({});
    expect(normalizeRatings([5])).toEqual({});
  });
});

describe("pickSources", () => {
  const movie = (title: string, tmdb_id: number | null, stars: number | null, watched_at = "2026-09-01", media_type: MediaType = "movie") =>
    ({ media_type, title, tmdb_id, watched_at, ratings: (stars == null ? {} : { "me@x.io": stars, "other@x.io": 1 }) as Record<string, number> });

  it("uses my favourites (4-5 stars) first and my dislikes (1-2 stars), ignoring 3 stars, unrated and untracked movies", () => {
    const sources = pickSources([
      movie("Okay", 1, 3), movie("Loved", 2, 5), movie("Liked", 3, 4), movie("Hated", 4, 1),
      movie("Unrated", 5, null), movie("Hand-added", null, 5),
    ], "me@x.io");
    expect(sources.map((s) => s.title)).toEqual(["Loved", "Liked", "Hated"]);
  });

  it("only looks at my own ratings", () => {
    expect(pickSources([movie("Loved", 2, 5)], "someone@x.io")).toEqual([]);
  });

  it("remembers whether a favourite is a movie or a TV show, so its recommendations come from the right place", () => {
    const sources = pickSources([movie("Severance", 95396, 5, "2026-09-01", "tv"), movie("Heat", 949, 5)], "me@x.io");
    expect(sources.map((s) => [s.title, s.media_type]).sort()).toEqual([["Heat", "movie"], ["Severance", "tv"]]);
  });

  it("prefers more recently watched favourites when there are many", () => {
    const many = Array.from({ length: 7 }, (_, i) => movie(`Fav ${i}`, 10 + i, 5, `2026-09-0${i + 1}`));
    expect(pickSources(many, "me@x.io").map((s) => s.title)).toEqual(["Fav 6", "Fav 5", "Fav 4", "Fav 3", "Fav 2"]);
  });
});

describe("rankSuggestions", () => {
  it("ranks movies recommended from several favourites highest and says why", () => {
    const ranked = rankSuggestions([
      { media_type: "movie" as const, tmdb_id: 1, title: "Heat", stars: 5, results: [r(10), r(12)] },
      { media_type: "movie" as const, tmdb_id: 2, title: "Collateral", stars: 4, results: [r(12), r(13)] },
    ], new Set());
    expect(ranked.map((s) => s.id)).toEqual([12, 10, 13]);
    expect(ranked[0].because).toEqual(["Heat", "Collateral"]);
    expect(ranked[2].because).toEqual(["Collateral"]);
  });

  it("skips movies already on the list", () => {
    const ranked = rankSuggestions([{ media_type: "movie" as const, tmdb_id: 1, title: "Heat", stars: 5, results: [r(10), r(11)] }], new Set([titleKey("movie", 10)]));
    expect(ranked.map((s) => s.id)).toEqual([11]);
  });

  it("lets a disliked movie cancel out its recommendations", () => {
    const ranked = rankSuggestions([
      { media_type: "movie" as const, tmdb_id: 1, title: "Heat", stars: 4, results: [r(10), r(11)] },
      { media_type: "movie" as const, tmdb_id: 2, title: "Bad", stars: 1, results: [r(10)] },
    ], new Set());
    expect(ranked.map((s) => s.id)).toEqual([11]);
  });

  it("ignores 3-star movies and respects the limit", () => {
    expect(rankSuggestions([{ media_type: "movie" as const, tmdb_id: 1, title: "Meh", stars: 3, results: [r(10)] }], new Set())).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => r(100 + i));
    expect(rankSuggestions([{ media_type: "movie" as const, tmdb_id: 1, title: "Heat", stars: 5, results: many }], new Set(), 5)).toHaveLength(5);
  });

  it("treats a movie and a TV show with the same TMDB id as different titles", () => {
    const sources = [{ media_type: "tv" as const, tmdb_id: 1, title: "Show", stars: 5, results: [r(500, 7, "movie"), r(500, 7, "tv")] }];
    expect(rankSuggestions(sources, new Set()).map((s) => titleKey(s.media_type, s.id)).sort()).toEqual(["movie:500", "tv:500"]);
    // Already having the movie doesn't hide the show.
    expect(rankSuggestions(sources, new Set([titleKey("movie", 500)])).map((s) => s.media_type)).toEqual(["tv"]);
  });
});

describe("half-star ratings in suggestions", () => {
  const rated = (id: number, stars: number) => ({ media_type: "movie" as const, tmdb_id: id, title: `T${id}`, ratings: { "me@x.io": stars }, watched_at: "2026-01-01" });
  it("counts 4.5 as a favourite and 1.5 as a dislike, but not 3.5 or 2.5", () => {
    const picked = pickSources([rated(1, 4.5), rated(2, 3.5), rated(3, 2.5), rated(4, 1.5)], "me@x.io");
    expect(picked.map((p) => p.tmdb_id)).toEqual([1, 4]);
  });
  it("weighs 4.5 stars above 4", () => {
    const ranked = rankSuggestions([
      { media_type: "movie" as const, tmdb_id: 1, title: "A", stars: 4, results: [r(10)] },
      { media_type: "movie" as const, tmdb_id: 2, title: "B", stars: 4.5, results: [r(11)] },
    ], new Set());
    expect(ranked.map((s) => s.id)).toEqual([11, 10]);
  });
});
