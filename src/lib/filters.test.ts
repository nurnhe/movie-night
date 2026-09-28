import { describe, expect, it } from "vitest";
import { allTags, formatRuntime, matchesFilters, emptyFilters, normalizeTag, parseTags, pickRandom, scopeAdders, sortMovies } from "./filters";
import type { Movie } from "./types";

const base: Movie = {
  id: "1", tmdb_id: 1, imdb_id: null, title: "Paddington 2", year: 2017, runtime: 104, genres: ["Comedy", "Family"], tags: ["cozy"], ratings: {},
  rating: 7.6, vote_count: 3000, poster_path: null, overview: null, note: "cozy", added_by: "a@x.com",
  watched: false, watched_at: null, created_at: "2026-09-01T00:00:00Z",
};
const long: Movie = { ...base, id: "2", title: "Oppenheimer", runtime: 180, genres: ["Drama", "History"], tags: [], rating: 8.1, added_by: "b@x.com", note: null, created_at: "2026-09-02T00:00:00Z" };
const bare: Movie = { ...base, id: "3", title: "Mystery pick", runtime: null, genres: [], tags: [], rating: null, created_at: "2026-09-03T00:00:00Z" };

describe("matchesFilters", () => {
  it("passes everything with empty filters", () => {
    expect([base, long, bare].every((m) => matchesFilters(m, emptyFilters))).toBe(true);
  });
  it("filters by any selected genre or custom tag", () => {
    expect(matchesFilters(base, { ...emptyFilters, tags: ["Drama", "Family"] })).toBe(true);
    expect(matchesFilters(long, { ...emptyFilters, tags: ["Comedy"] })).toBe(false);
    expect(matchesFilters(base, { ...emptyFilters, tags: ["cozy"] })).toBe(true);
    expect(matchesFilters(long, { ...emptyFilters, tags: ["cozy"] })).toBe(false);
  });
  it("finds custom tags through search", () => {
    expect(matchesFilters({ ...base, note: null }, { ...emptyFilters, search: "coz" })).toBe(true);
  });
  it("filters by max runtime and excludes unknown runtimes", () => {
    const f = { ...emptyFilters, maxRuntime: 120 };
    expect(matchesFilters(base, f)).toBe(true);
    expect(matchesFilters(long, f)).toBe(false);
    expect(matchesFilters(bare, f)).toBe(false);
  });
  it("filters by min rating and search", () => {
    expect(matchesFilters(base, { ...emptyFilters, minRating: 8 })).toBe(false);
    expect(matchesFilters(long, { ...emptyFilters, minRating: 8 })).toBe(true);
    expect(matchesFilters(base, { ...emptyFilters, search: "COZY" })).toBe(true);
  });
  it("keeps only movies added by the given people, ignoring email case", () => {
    expect(matchesFilters(base, emptyFilters, ["b@x.com"])).toBe(false);
    expect(matchesFilters(long, emptyFilters, ["b@x.com"])).toBe(true);
    expect(matchesFilters({ ...base, added_by: "A@X.com" }, emptyFilters, ["a@x.com"])).toBe(true);
    expect(matchesFilters({ ...base, added_by: null }, emptyFilters, ["a@x.com"])).toBe(false);
  });
});

describe("scopeAdders", () => {
  const groups = [{ id: "g1", members: ["a@x.com", "b@x.com"] }];
  it("means everyone when empty", () => expect(scopeAdders("", "a@x.com", groups)).toBeNull());
  it("means just me for 'mine'", () => expect(scopeAdders("mine", "a@x.com", groups)).toEqual(["a@x.com"]));
  it("means the group's members for a group", () => expect(scopeAdders("group:g1", "a@x.com", groups)).toEqual(["a@x.com", "b@x.com"]));
  it("falls back to everyone for a group that no longer exists", () => expect(scopeAdders("group:gone", "a@x.com", groups)).toBeNull());
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

describe("tags", () => {
  it("normalizes a tag: trims, lowercases, drops a leading #, collapses spaces", () => {
    expect(normalizeTag("  #Date   Night ")).toBe("date night");
    expect(normalizeTag("   ")).toBeNull();
    expect(normalizeTag("x".repeat(40))).toHaveLength(30);
  });
  it("parses a comma-separated list without duplicates", () => {
    expect(parseTags("Cozy, cozy,  rainy day ,, #Classic")).toEqual(["cozy", "rainy day", "classic"]);
  });
  it("lists genres and custom tags together, sorted without regard to case", () => {
    expect(allTags([base, long])).toEqual(["Comedy", "cozy", "Drama", "Family", "History"]);
  });
});
