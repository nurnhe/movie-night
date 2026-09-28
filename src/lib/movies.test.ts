import { describe, expect, it } from "vitest";
import { normalizeMovie } from "./movies";

describe("normalizeMovie", () => {
  it("fills in every field with a safe default from an empty document", () => {
    expect(normalizeMovie("m1", {}, "movies")).toEqual({
      id: "m1", tmdb_id: null, imdb_id: null, title: "Untitled", year: null, runtime: null, genres: [],
      rating: null, vote_count: null, poster_path: null, overview: null, note: null, added_by: null,
      watched: false, watched_at: null, created_at: new Date(0).toISOString(), tags: [], ratings: {},
      shared_with: "all", owner: null,
    });
  });

  it("rejects wrong-typed values instead of passing them through", () => {
    const m = normalizeMovie("m2", { title: 5, genres: "Drama", tags: [1, "cozy", null], watched: "yes", rating: "9" }, "movies");
    expect(m.title).toBe("Untitled");
    expect(m.genres).toEqual([]);
    expect(m.tags).toEqual(["cozy"]);
    expect(m.watched).toBe(false);
    expect(m.rating).toBeNull();
  });

  it("reads who a restricted movie is shared with", () => {
    expect(normalizeMovie("r1", { owner: "k@x.io", group_id: null }, "restricted")).toMatchObject({ shared_with: "me", owner: "k@x.io" });
    expect(normalizeMovie("r2", { owner: "k@x.io", group_id: "g1" }, "restricted")).toMatchObject({ shared_with: "group:g1", owner: "k@x.io" });
  });

  it("keeps well-formed values as they are", () => {
    const m = normalizeMovie("m3", { title: "Heat", tmdb_id: 949, year: 1995, genres: ["Crime"], tags: ["cozy"], watched: true, created_at: "2026-01-01T00:00:00.000Z", ratings: { "a@x.io": 5 } }, "movies");
    expect(m).toMatchObject({ title: "Heat", tmdb_id: 949, year: 1995, genres: ["Crime"], tags: ["cozy"], watched: true, created_at: "2026-01-01T00:00:00.000Z", ratings: { "a@x.io": 5 } });
  });
});
