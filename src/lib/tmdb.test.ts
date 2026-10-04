import { afterEach, describe, expect, it, vi } from "vitest";
import { recommendations, searchTitles, TMDB_NOTICE, TmdbError, titleDetails, titleLinks } from "./tmdb";

// TMDB can't be called without a token here, so these replay the response shapes its docs describe.
function respondWith(routes: Record<string, unknown>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const u = new URL(url);
    calls.push(u.pathname + u.search);
    if (!(u.pathname in routes)) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(routes[u.pathname]), { status: 200 });
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("searchTitles", () => {
  it("returns movies and TV shows from one search, labels anime, and drops people", async () => {
    respondWith({
      "/3/search/multi": { results: [
        { id: 1, media_type: "movie", title: "Spirited Away", release_date: "2001-07-20", poster_path: "/a.jpg", vote_average: 8.5, vote_count: 900, genre_ids: [16, 14], original_language: "ja" },
        { id: 2, media_type: "tv", name: "Severance", first_air_date: "2022-02-18", poster_path: "/b.jpg", vote_average: 8.4, vote_count: 500, genre_ids: [18, 9648], original_language: "en" },
        { id: 3, media_type: "person", name: "Someone" },
        { id: 4, media_type: "tv", name: "Frieren", first_air_date: "2023-09-29", poster_path: null, vote_average: 0, vote_count: 0, genre_ids: [16, 18], original_language: "ja" },
      ] },
    });
    const results = await searchTitles("anything");
    expect(results.map((r) => [r.media_type, r.title, r.year, r.anime])).toEqual([
      ["movie", "Spirited Away", 2001, true],
      ["tv", "Severance", 2022, false],
      ["tv", "Frieren", 2023, true],
    ]);
    expect(results[2].rating).toBeNull();
  });
});

describe("recommendations", () => {
  it("asks the endpoint that matches the title's type and keeps that type", async () => {
    const calls = respondWith({
      "/3/tv/77/recommendations": { results: [{ id: 10, name: "Dark", first_air_date: "2017-12-01", poster_path: null, vote_average: 8.4, vote_count: 10, genre_ids: [], original_language: "de" }] },
    });
    const results = await recommendations(77, "tv");
    expect(calls[0]).toContain("/3/tv/77/recommendations");
    expect(results).toMatchObject([{ id: 10, media_type: "tv", title: "Dark", year: 2017 }]);
  });
});

describe("titleDetails", () => {
  it("reads a TV show: episode length, size, status, IMDb id, and split genres", async () => {
    const calls = respondWith({
      "/3/tv/95396": {
        id: 95396, name: "Severance", first_air_date: "2022-02-18", episode_run_time: [], last_episode_to_air: { runtime: 50 },
        number_of_seasons: 2, number_of_episodes: 19, status: "Returning Series", poster_path: "/p.jpg", overview: "Office.",
        vote_average: 8.4, vote_count: 3000, original_language: "en", external_ids: { imdb_id: "tt11280740" },
        genres: [{ id: 18, name: "Drama" }, { id: 10765, name: "Sci-Fi & Fantasy" }, { id: 9648, name: "Mystery" }],
      },
    });
    const d = await titleDetails(95396, "tv");
    expect(calls[0]).toContain("append_to_response=external_ids");
    expect(d).toMatchObject({
      media_type: "tv", anime: false, tmdb_id: 95396, imdb_id: "tt11280740", title: "Severance", year: 2022,
      runtime: 50, seasons: 2, episodes: 19, series_status: "Returning Series", rating: 8.4,
    });
    expect(d.genres).toEqual(["Drama", "Sci-Fi", "Fantasy", "Mystery"]);
  });

  it("prefers the typical episode length when TMDB lists one", async () => {
    respondWith({ "/3/tv/1": { id: 1, name: "X", episode_run_time: [24], last_episode_to_air: { runtime: 30 }, genres: [], vote_average: 0, vote_count: 0, poster_path: null, overview: "" } });
    expect((await titleDetails(1, "tv")).runtime).toBe(24);
  });

  it("flags a Japanese animated film as anime and keeps it a movie", async () => {
    respondWith({
      "/3/movie/129": {
        id: 129, imdb_id: "tt0245429", title: "Spirited Away", release_date: "2001-07-20", runtime: 125, original_language: "ja",
        genres: [{ id: 16, name: "Animation" }, { id: 14, name: "Fantasy" }, { id: 878, name: "Science Fiction" }],
        vote_average: 8.5, vote_count: 16000, poster_path: "/s.jpg", overview: "A girl.",
      },
    });
    const d = await titleDetails(129, "movie");
    expect(d).toMatchObject({ media_type: "movie", anime: true, runtime: 125, seasons: null, episodes: null, series_status: null });
    expect(d.genres).toEqual(["Animation", "Fantasy", "Sci-Fi"]);
  });

  it("fails clearly when TMDB doesn't know the title", async () => {
    respondWith({});
    await expect(titleDetails(404, "tv")).rejects.toThrow("TMDB request failed (404)");
  });

  it("reports the HTTP status, so a title TMDB no longer has can be told apart from an outage", async () => {
    respondWith({});
    const err = await titleDetails(404, "movie").catch((e) => e);
    expect(err).toBeInstanceOf(TmdbError);
    expect(err.status).toBe(404);
  });
});

describe("titleLinks", () => {
  it("links movies to Letterboxd and IMDb", () => {
    expect(titleLinks({ tmdb_id: 129, imdb_id: "tt0245429", media_type: "movie" })).toEqual([
      { label: "Letterboxd", url: "https://letterboxd.com/tmdb/129/" },
      { label: "IMDb", url: "https://www.imdb.com/title/tt0245429/" },
    ]);
  });
  it("links TV shows to TMDB's TV page instead, since Letterboxd is films only", () => {
    expect(titleLinks({ tmdb_id: 95396, imdb_id: null, media_type: "tv" })).toEqual([
      { label: "TMDB", url: "https://www.themoviedb.org/tv/95396" },
    ]);
  });
  it("has nothing to link for a title added by hand", () => {
    expect(titleLinks({ tmdb_id: null, imdb_id: null, media_type: "movie" })).toEqual([]);
  });
});

describe("TMDB attribution", () => {
  // Section 3 of TMDB's API terms makes this exact wording a condition of the licence.
  it("uses the notice wording the terms require", () => {
    const required = "This [website, program, service, application, product] uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";
    expect(TMDB_NOTICE).toBe(required.replace("[website, program, service, application, product]", "website"));
  });
});
