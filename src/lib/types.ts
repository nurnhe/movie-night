// Which TMDB endpoint a title comes from; TMDB numbers movies and TV shows separately.
export type MediaType = "movie" | "tv";

export interface Movie {
  id: string;
  media_type: MediaType;
  anime: boolean;   // Japanese-language animation, series or film
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  year: number | null;
  runtime: number | null; // minutes; per episode for TV
  seasons: number | null;
  episodes: number | null;
  series_status: string | null; // TMDB's status for a TV show, e.g. "Ended"
  genres: string[]; // from TMDB
  tags: string[];   // added by people, lowercase
  ratings: Record<string, number>; // 0.5-5 stars (half steps) by lowercase email, after watching
  rating: number | null;
  vote_count: number | null;
  poster_path: string | null;
  overview: string | null;
  note: string | null;
  added_by: string | null;
  watched: boolean;
  watching: boolean; // in progress; never true together with watched
  watched_at: string | null;
  created_at: string;
  tmdb_synced_at: string | null; // when the TMDB-sourced fields were last fetched; TMDB data may only be kept 6 months
  shared_with: string; // "all", "me" (only the owner), or "group:<id>"
  owner: string | null; // lowercase email; set on movies not shared with everyone
}

export type NewMovie = Omit<Movie, "id" | "watched" | "watching" | "watched_at" | "created_at" | "tmdb_synced_at" | "ratings" | "shared_with" | "owner">;

export interface Group {
  id: string;
  name: string;
  members: string[]; // lowercase emails
  created_by: string;
  created_at: string;
}

export interface Person {
  email: string; // lowercase
  name: string;  // may be empty
}
