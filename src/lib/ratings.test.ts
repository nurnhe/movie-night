import { describe, expect, it } from "vitest";
import { normalizeRatings, pickSources, rankSuggestions } from "./ratings";

const r = (id: number, rating: number | null = 7) => ({ id, title: `Movie ${id}`, year: 2020, poster_path: null, rating });

describe("normalizeRatings", () => {
  it("keeps whole-star ratings from 1 to 5 and drops everything else", () => {
    expect(normalizeRatings({ "a@x.io": 5, "b@x.io": 0, "c@x.io": 3.5, "d@x.io": "4", "e@x.io": 1 })).toEqual({ "a@x.io": 5, "e@x.io": 1 });
  });
  it("treats missing or malformed values as no ratings", () => {
    expect(normalizeRatings(undefined)).toEqual({});
    expect(normalizeRatings([5])).toEqual({});
  });
});

describe("pickSources", () => {
  const movie = (title: string, tmdb_id: number | null, stars: number | null, watched_at = "2026-09-01") =>
    ({ title, tmdb_id, watched_at, ratings: (stars == null ? {} : { "me@x.io": stars, "other@x.io": 1 }) as Record<string, number> });

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

  it("prefers more recently watched favourites when there are many", () => {
    const many = Array.from({ length: 7 }, (_, i) => movie(`Fav ${i}`, 10 + i, 5, `2026-09-0${i + 1}`));
    expect(pickSources(many, "me@x.io").map((s) => s.title)).toEqual(["Fav 6", "Fav 5", "Fav 4", "Fav 3", "Fav 2"]);
  });
});

describe("rankSuggestions", () => {
  it("ranks movies recommended from several favourites highest and says why", () => {
    const ranked = rankSuggestions([
      { tmdb_id: 1, title: "Heat", stars: 5, results: [r(10), r(12)] },
      { tmdb_id: 2, title: "Collateral", stars: 4, results: [r(12), r(13)] },
    ], new Set());
    expect(ranked.map((s) => s.id)).toEqual([12, 10, 13]);
    expect(ranked[0].because).toEqual(["Heat", "Collateral"]);
    expect(ranked[2].because).toEqual(["Collateral"]);
  });

  it("skips movies already on the list", () => {
    const ranked = rankSuggestions([{ tmdb_id: 1, title: "Heat", stars: 5, results: [r(10), r(11)] }], new Set([10]));
    expect(ranked.map((s) => s.id)).toEqual([11]);
  });

  it("lets a disliked movie cancel out its recommendations", () => {
    const ranked = rankSuggestions([
      { tmdb_id: 1, title: "Heat", stars: 4, results: [r(10), r(11)] },
      { tmdb_id: 2, title: "Bad", stars: 1, results: [r(10)] },
    ], new Set());
    expect(ranked.map((s) => s.id)).toEqual([11]);
  });

  it("ignores 3-star movies and respects the limit", () => {
    expect(rankSuggestions([{ tmdb_id: 1, title: "Meh", stars: 3, results: [r(10)] }], new Set())).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => r(100 + i));
    expect(rankSuggestions([{ tmdb_id: 1, title: "Heat", stars: 5, results: many }], new Set(), 5)).toHaveLength(5);
  });
});
