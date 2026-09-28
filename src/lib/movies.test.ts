import { describe, expect, it } from "vitest";
import { normalizeMovie } from "./movies";

describe("normalizeMovie", () => {
  it("fills in every field with a safe default from an empty document", () => {
    expect(normalizeMovie("m1", {})).toEqual({
      id: "m1", tmdb_id: null, imdb_id: null, title: "Untitled", year: null, runtime: null, genres: [],
      rating: null, vote_count: null, poster_path: null, overview: null, note: null, added_by: null,
      watched: false, watched_at: null, created_at: new Date(0).toISOString(), tags: [], ratings: {},
    });
  });

  it("rejects wrong-typed values instead of passing them through", () => {
    const m = normalizeMovie("m2", { title: 5, genres: "Drama", tags: [1, "cozy", null], watched: "yes", rating: "9" });
    expect(m.title).toBe("Untitled");
    expect(m.genres).toEqual([]);
    expect(m.tags).toEqual(["cozy"]);
    expect(m.watched).toBe(false);
    expect(m.rating).toBeNull();
  });

  it("keeps well-formed values as they are", () => {
    const m = normalizeMovie("m3", { title: "Heat", tmdb_id: 949, year: 1995, genres: ["Crime"], tags: ["cozy"], watched: true, created_at: "2026-01-01T00:00:00.000Z", ratings: { "a@x.io": 5 } });
    expect(m).toMatchObject({ title: "Heat", tmdb_id: 949, year: 1995, genres: ["Crime"], tags: ["cozy"], watched: true, created_at: "2026-01-01T00:00:00.000Z", ratings: { "a@x.io": 5 } });
  });
});
