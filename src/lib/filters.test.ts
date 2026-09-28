import { describe, expect, it } from "vitest";
import { formatRuntime, matchesFilters, emptyFilters, pickRandom, sortMovies } from "./filters";
import type { Movie } from "./types";

const base: Movie = {
  id: "1", tmdb_id: 1, imdb_id: null, title: "Paddington 2", year: 2017, runtime: 104, genres: ["Comedy", "Family"],
  rating: 7.6, vote_count: 3000, poster_path: null, overview: null, note: "cozy", added_by: "a@x.com",
  watched: false, watched_at: null, created_at: "2026-09-01T00:00:00Z",
};
const long: Movie = { ...base, id: "2", title: "Oppenheimer", runtime: 180, genres: ["Drama", "History"], rating: 8.1, added_by: "b@x.com", note: null, created_at: "2026-09-02T00:00:00Z" };
const bare: Movie = { ...base, id: "3", title: "Mystery pick", runtime: null, genres: [], rating: null, created_at: "2026-09-03T00:00:00Z" };

describe("matchesFilters", () => {
  it("passes everything with empty filters", () => {
    expect([base, long, bare].every((m) => matchesFilters(m, emptyFilters))).toBe(true);
  });
  it("filters by any selected genre", () => {
    expect(matchesFilters(base, { ...emptyFilters, genres: ["Drama", "Family"] })).toBe(true);
    expect(matchesFilters(long, { ...emptyFilters, genres: ["Comedy"] })).toBe(false);
  });
  it("filters by max runtime and excludes unknown runtimes", () => {
    const f = { ...emptyFilters, maxRuntime: 120 };
    expect(matchesFilters(base, f)).toBe(true);
    expect(matchesFilters(long, f)).toBe(false);
    expect(matchesFilters(bare, f)).toBe(false);
  });
  it("filters by min rating, search and who added it", () => {
    expect(matchesFilters(base, { ...emptyFilters, minRating: 8 })).toBe(false);
    expect(matchesFilters(long, { ...emptyFilters, minRating: 8 })).toBe(true);
    expect(matchesFilters(base, { ...emptyFilters, search: "COZY" })).toBe(true);
    expect(matchesFilters(base, { ...emptyFilters, addedBy: "b@x.com" })).toBe(false);
  });
});

describe("pickRandom", () => {
  it("returns null for an empty pool", () => expect(pickRandom([], null)).toBeNull());
  it("avoids repeating the previous pick when possible", () => {
    for (let i = 0; i < 20; i++) expect(pickRandom([base, long], "1")?.id).toBe("2");
    expect(pickRandom([base], "1")?.id).toBe("1");
  });
});

describe("helpers", () => {
  it("formats runtime", () => {
    expect(formatRuntime(104)).toBe("1h 44m");
    expect(formatRuntime(45)).toBe("45m");
    expect(formatRuntime(null)).toBe("");
  });
  it("sorts by rating with unrated last", () => {
    expect(sortMovies([bare, base, long], "rating").map((m) => m.id)).toEqual(["2", "1", "3"]);
  });
  it("sorts newest added first by default", () => {
    expect(sortMovies([base, long, bare], "added").map((m) => m.id)).toEqual(["3", "2", "1"]);
  });
});
