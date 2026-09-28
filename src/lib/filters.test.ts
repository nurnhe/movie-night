import { describe, expect, it } from "vitest";
import { allTags, formatRuntime, hasTag, matchesFilters, emptyFilters, normalizeTag, parseTags, pickRandom, sortMovies, tagLabel, tagLabels, toggleTag } from "./filters";
import type { Movie } from "./types";

const base: Movie = {
  id: "1", tmdb_id: 1, imdb_id: null, title: "Paddington 2", year: 2017, runtime: 104, genres: ["Comedy", "Family"], tags: ["cozy"], ratings: {},
  rating: 7.6, vote_count: 3000, poster_path: null, overview: null, note: "cozy", added_by: "a@x.com",
  watched: false, watched_at: null, created_at: "2026-09-01T00:00:00Z", shared_with: "all", owner: null,
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
  it("filters by who a movie is shared with", () => {
    const priv = { ...base, id: "p", shared_with: "me", owner: "a@x.com" };
    const grp = { ...base, id: "g", shared_with: "group:g1", owner: "a@x.com" };
    expect([base, priv, grp].filter((m) => matchesFilters(m, { ...emptyFilters, scope: "all" })).map((m) => m.id)).toEqual(["1"]);
    expect([base, priv, grp].filter((m) => matchesFilters(m, { ...emptyFilters, scope: "me" })).map((m) => m.id)).toEqual(["p"]);
    expect([base, priv, grp].filter((m) => matchesFilters(m, { ...emptyFilters, scope: "group:g1" })).map((m) => m.id)).toEqual(["g"]);
    expect([base, priv, grp].every((m) => matchesFilters(m, emptyFilters))).toBe(true);
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

describe("tags that differ only by case", () => {
  const genreComedy = { genres: ["Comedy"], tags: [] as string[] };
  const customComedy = { genres: [] as string[], tags: ["comedy", "cozy"] };

  it("list a genre and a custom tag with the same name once, using the genre's spelling", () => {
    expect(allTags([customComedy, genreComedy])).toEqual(["Comedy", "cozy"]);
  });

  it("show a custom tag with the genre's spelling when one exists", () => {
    const labels = tagLabels([customComedy, genreComedy]);
    expect(tagLabel(labels, "comedy")).toBe("Comedy");
    expect(tagLabel(labels, "cozy")).toBe("cozy");
    expect(tagLabel(labels, "unknown")).toBe("unknown");
  });

  it("filter across both spellings", () => {
    const tagged = { ...base, id: "t", genres: [], tags: ["comedy"] };
    const genred = { ...base, id: "g", genres: ["Comedy"], tags: [] };
    expect(matchesFilters(tagged, { ...emptyFilters, tags: ["Comedy"] })).toBe(true);
    expect(matchesFilters(genred, { ...emptyFilters, tags: ["comedy"] })).toBe(true);
  });

  it("toggle a selected tag off whatever its capitals", () => {
    expect(hasTag(["Comedy"], "comedy")).toBe(true);
    expect(toggleTag(["Comedy", "cozy"], "comedy")).toEqual(["cozy"]);
    expect(toggleTag(["cozy"], "Comedy")).toEqual(["cozy", "Comedy"]);
  });
});
