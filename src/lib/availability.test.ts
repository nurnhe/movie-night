import { afterEach, describe, expect, it, vi } from "vitest";
import { availabilityKey, isFresh, matchesStreaming, parseAvailability, serviceOf, titlesToCheck, AVAILABILITY_TTL_MS, type AvailabilityCache } from "./availability";
import { emptyFilters, matchesFilters } from "./filters";
import { watchProviders } from "./tmdb";
import type { Movie } from "./types";

afterEach(() => vi.unstubAllGlobals());

const movie = (over: Partial<Movie>): Movie => ({
  id: "1", media_type: "movie", anime: false, tmdb_id: 10, imdb_id: null, title: "T", year: 2020, runtime: 100,
  seasons: null, episodes: null, series_status: null, genres: [], tags: [], ratings: {}, rating: 7, vote_count: 1,
  poster_path: null, overview: null, note: null, added_by: null, watched: false, watching: false, watched_at: null,
  created_at: "2026-01-01T00:00:00Z", tmdb_synced_at: null, shared_with: "all", owner: null, ...over,
});

describe("serviceOf", () => {
  it("recognises Netflix and HBO's service under either of its names", () => {
    expect(serviceOf("Netflix")).toBe("netflix");
    expect(serviceOf("Netflix Standard with Ads")).toBe("netflix");
    expect(serviceOf("Max")).toBe("hbo");
    expect(serviceOf("HBO Max")).toBe("hbo");
    expect(serviceOf("hbo max")).toBe("hbo");
  });
  it("ignores other services, look-alikes and resold channels", () => {
    expect(serviceOf("Disney Plus")).toBeNull();
    expect(serviceOf("Maxdome")).toBeNull();
    expect(serviceOf("HBO Max Amazon Channel")).toBeNull();
    expect(serviceOf("Amazon Prime Video")).toBeNull();
  });
});

describe("parseAvailability", () => {
  const raw = { results: {
    RS: { link: "https://www.themoviedb.org/movie/1/watch?locale=RS", flatrate: [{ provider_name: "Netflix" }, { provider_name: "Max" }, { provider_name: "Disney Plus" }], rent: [{ provider_name: "Apple TV" }] },
    US: { link: "x", flatrate: [{ provider_name: "Hulu" }] },
  } };
  it("lists the subscription services in Serbia, Netflix first, and links to TMDB's page", () => {
    expect(parseAvailability(raw)).toEqual({ services: ["netflix", "hbo"], link: "https://www.themoviedb.org/movie/1/watch?locale=RS" });
  });
  it("does not count renting or buying, or other countries", () => {
    expect(parseAvailability({ results: { RS: { link: "l", rent: [{ provider_name: "Netflix" }], buy: [{ provider_name: "Max" }] } as never, US: { flatrate: [{ provider_name: "Netflix" }] } } }).services).toEqual([]);
  });
  it("copes with no data for Serbia", () => {
    expect(parseAvailability({ results: { US: {} } })).toEqual({ services: [], link: null });
    expect(parseAvailability({})).toEqual({ services: [], link: null });
  });
});

describe("watchProviders", () => {
  it("asks TMDB for the right media type and parses the answer", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(new URL(url).pathname);
      return new Response(JSON.stringify({ id: 5, results: { RS: { link: "l", flatrate: [{ provider_name: "HBO Max" }] } } }), { status: 200 });
    }));
    expect((await watchProviders(5, "tv")).services).toEqual(["hbo"]);
    await watchProviders(6, "movie");
    expect(urls).toEqual(["/3/tv/5/watch/providers", "/3/movie/6/watch/providers"]);
  });
});

describe("which titles get looked up", () => {
  const now = 1_000_000_000_000;
  const fresh: AvailabilityCache = { "movie:10": { services: [], link: null, at: now - 1000 } };
  it("skips watched, hand-added and already-fresh titles, and counts a movie and show with the same id separately", () => {
    const list = [
      movie({ id: "a", tmdb_id: 10 }), movie({ id: "b", tmdb_id: 11, watched: true }), movie({ id: "c", tmdb_id: null }),
      movie({ id: "d", tmdb_id: 10, media_type: "tv" }), movie({ id: "e", tmdb_id: 12 }), movie({ id: "f", tmdb_id: 12, shared_with: "me" }),
    ];
    expect(titlesToCheck(list, fresh, now).map((m) => m.id)).toEqual(["d", "e"]);
  });
  it("looks up again once an answer is a day old", () => {
    const old: AvailabilityCache = { "movie:10": { services: ["netflix"], link: null, at: now - AVAILABILITY_TTL_MS - 1 } };
    expect(isFresh(old["movie:10"], now)).toBe(false);
    expect(titlesToCheck([movie({})], old, now)).toHaveLength(1);
  });
  it("builds keys that tell movies and shows apart", () => {
    expect(availabilityKey(movie({ tmdb_id: 7, media_type: "tv" }))).toBe("tv:7");
    expect(availabilityKey(movie({ tmdb_id: null }))).toBeNull();
  });
});

describe("streaming filter", () => {
  it("passes everything when off, and only matching titles when on", () => {
    expect(matchesStreaming("", undefined)).toBe(true);
    expect(matchesStreaming("any", ["hbo"])).toBe(true);
    expect(matchesStreaming("netflix", ["hbo"])).toBe(false);
    expect(matchesStreaming("netflix", ["netflix", "hbo"])).toBe(true);
    expect(matchesStreaming("any", [])).toBe(false);
    expect(matchesStreaming("any", undefined)).toBe(false);
  });
  it("combines with the other filters", () => {
    const m = movie({ runtime: 200 });
    const on = () => ["netflix" as const];
    expect(matchesFilters(m, { ...emptyFilters, streaming: "netflix" }, on)).toBe(true);
    expect(matchesFilters(m, { ...emptyFilters, streaming: "netflix", maxRuntime: 120 }, on)).toBe(false);
    expect(matchesFilters(m, { ...emptyFilters, streaming: "hbo" }, on)).toBe(false);
  });
});
