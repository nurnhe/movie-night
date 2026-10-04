import { describe, expect, it } from "vitest";
import { dataAgeDays, mustPurge, purgePatch, refreshPatch, REFRESH_BATCH, staleTitles } from "./tmdbCache";
import type { TitleDetails } from "./tmdb";

const NOW = Date.parse("2026-10-04T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();
const title = (id: string, tmdb_id: number | null, syncedDays: number | null, createdDays = 400) =>
  ({ id, tmdb_id, tmdb_synced_at: syncedDays == null ? null : daysAgo(syncedDays), created_at: daysAgo(createdDays) });

describe("dataAgeDays", () => {
  it("counts from the last sync", () => expect(dataAgeDays(title("a", 1, 12), NOW)).toBe(12));
  it("falls back to when the title was added, for titles from before syncing was tracked", () => {
    expect(dataAgeDays(title("a", 1, null, 70), NOW)).toBe(70);
  });
  it("treats an unreadable date as ancient, so it gets refreshed", () => {
    expect(dataAgeDays({ tmdb_synced_at: "nonsense", created_at: "also nonsense" }, NOW)).toBe(Infinity);
  });
  it("never goes negative if a clock is off", () => {
    expect(dataAgeDays({ tmdb_synced_at: new Date(NOW + 5 * 86400000).toISOString(), created_at: daysAgo(1) }, NOW)).toBe(0);
  });
});

describe("staleTitles", () => {
  it("picks titles a month old or more, oldest first, and leaves fresh ones alone", () => {
    const list = [title("fresh", 1, 5), title("month", 2, 30), title("old", 3, 90), title("legacy", 4, null, 45)];
    expect(staleTitles(list, NOW).map((m) => m.id)).toEqual(["old", "legacy", "month"]);
  });
  it("skips titles added by hand, which have nothing from TMDB", () => {
    expect(staleTitles([title("manual", null, null, 300)], NOW)).toEqual([]);
  });
  it("takes one batch at a time", () => {
    const many = Array.from({ length: REFRESH_BATCH + 10 }, (_, i) => title(`t${i}`, i + 1, 40 + i));
    const batch = staleTitles(many, NOW);
    expect(batch).toHaveLength(REFRESH_BATCH);
    expect(batch[0].id).toBe(`t${REFRESH_BATCH + 9}`);
  });
});

describe("mustPurge", () => {
  it("is only true once data is well past a month and nearing the 6-month limit", () => {
    expect(mustPurge(title("a", 1, 60), NOW)).toBe(false);
    expect(mustPurge(title("a", 1, 149), NOW)).toBe(false);
    expect(mustPurge(title("a", 1, 150), NOW)).toBe(true);
  });
});

describe("refreshPatch", () => {
  const details: TitleDetails = {
    media_type: "tv", anime: true, tmdb_id: 1, imdb_id: "tt1", title: "New Name", year: 2024, runtime: 24, seasons: 2, episodes: 30,
    series_status: "Ended", genres: ["Drama"], rating: 8.1, vote_count: 99, poster_path: "/p.jpg", overview: "Fresh.",
  };
  it("updates what TMDB supplies and stamps the sync time", () => {
    const patch = refreshPatch(details, "2026-10-04T12:00:00.000Z");
    expect(patch).toMatchObject({ title: "New Name", rating: 8.1, overview: "Fresh.", series_status: "Ended", tmdb_synced_at: "2026-10-04T12:00:00.000Z" });
  });
  it("never touches what people added", () => {
    const keys = Object.keys(refreshPatch(details, "now"));
    for (const mine of ["note", "tags", "ratings", "added_by", "watched", "watching", "watched_at", "created_at", "owner", "group_id", "media_type", "tmdb_id"]) {
      expect(keys).not.toContain(mine);
    }
  });
});

describe("purgePatch", () => {
  it("clears TMDB's descriptive data but keeps the name, year and ids that identify the entry", () => {
    expect(purgePatch).toMatchObject({ overview: null, poster_path: null, rating: null, genres: [] });
    for (const kept of ["title", "year", "tmdb_id", "media_type", "anime", "note", "tags"]) expect(Object.keys(purgePatch)).not.toContain(kept);
  });
});
