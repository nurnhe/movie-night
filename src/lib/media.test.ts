import { describe, expect, it } from "vitest";
import { isAnime, kindOf, normalizeGenres, seriesSize, seriesStatusLabel, statusOf, statusPatch, titleKey } from "./media";

describe("isAnime", () => {
  it("is Japanese-language animation", () => {
    expect(isAnime([16, 18], "ja")).toBe(true);
  });
  it("is not animation in another language, or Japanese live action", () => {
    expect(isAnime([16, 35], "en")).toBe(false);
    expect(isAnime([18], "ja")).toBe(false);
    expect(isAnime([16], undefined)).toBe(false);
  });
});

describe("kindOf", () => {
  it("calls Japanese animation anime whether it's a series or a film", () => {
    expect(kindOf({ media_type: "tv", anime: true })).toBe("anime");
    expect(kindOf({ media_type: "movie", anime: true })).toBe("anime");
  });
  it("otherwise follows the media type", () => {
    expect(kindOf({ media_type: "tv", anime: false })).toBe("tv");
    expect(kindOf({ media_type: "movie", anime: false })).toBe("movie");
  });
});

describe("statusOf", () => {
  it("is done once watched, even if a stale watching flag is set", () => {
    expect(statusOf({ watched: true, watching: true })).toBe("done");
  });
  it("is watching or todo otherwise", () => {
    expect(statusOf({ watched: false, watching: true })).toBe("watching");
    expect(statusOf({ watched: false, watching: false })).toBe("todo");
  });
});

describe("statusPatch", () => {
  const now = "2026-10-04T12:00:00.000Z";
  it("starts watching without marking anything watched", () => {
    expect(statusPatch("watching", now)).toEqual({ watched: false, watching: true, watched_at: null });
  });
  it("finishing clears the in-progress flag and stamps when it was watched", () => {
    expect(statusPatch("done", now)).toEqual({ watched: true, watching: false, watched_at: now });
  });
  it("moving back to the list clears both", () => {
    expect(statusPatch("todo", now)).toEqual({ watched: false, watching: false, watched_at: null });
  });
  it("round-trips through statusOf", () => {
    for (const s of ["todo", "watching", "done"] as const) expect(statusOf(statusPatch(s, now))).toBe(s);
  });
});

describe("titleKey", () => {
  it("keeps a movie and a TV show with the same TMDB id apart", () => {
    expect(titleKey("movie", 1399)).not.toBe(titleKey("tv", 1399));
  });
});

describe("normalizeGenres", () => {
  it("splits TV's combined genres and unifies Science Fiction with Sci-Fi", () => {
    expect(normalizeGenres(["Sci-Fi & Fantasy", "Drama"])).toEqual(["Sci-Fi", "Fantasy", "Drama"]);
    expect(normalizeGenres(["Action & Adventure", "War & Politics"])).toEqual(["Action", "Adventure", "War", "Politics"]);
    expect(normalizeGenres(["Science Fiction"])).toEqual(["Sci-Fi"]);
  });
  it("drops duplicates created by the split", () => {
    expect(normalizeGenres(["Sci-Fi & Fantasy", "Science Fiction", "Fantasy"])).toEqual(["Sci-Fi", "Fantasy"]);
  });
});

describe("series display", () => {
  it("labels TMDB's show statuses", () => {
    expect(seriesStatusLabel("Returning Series")).toBe("Airing");
    expect(seriesStatusLabel("Ended")).toBe("Ended");
    expect(seriesStatusLabel("Canceled")).toBe("Canceled");
    expect(seriesStatusLabel("Planned")).toBe("Coming soon");
    expect(seriesStatusLabel("Something new")).toBeNull();
    expect(seriesStatusLabel(null)).toBeNull();
  });
  it("describes how big a show is, pluralizing correctly", () => {
    expect(seriesSize(3, 30)).toBe("3 seasons · 30 episodes");
    expect(seriesSize(1, 1)).toBe("1 season · 1 episode");
    expect(seriesSize(null, 12)).toBe("12 episodes");
    expect(seriesSize(null, null)).toBe("");
  });
});
