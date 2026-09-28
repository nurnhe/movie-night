export interface Movie {
  id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  year: number | null;
  runtime: number | null;
  genres: string[]; // from TMDB
  tags: string[];   // added by people, lowercase
  ratings: Record<string, number>; // 1-5 stars by lowercase email, after watching
  rating: number | null;
  vote_count: number | null;
  poster_path: string | null;
  overview: string | null;
  note: string | null;
  added_by: string | null;
  watched: boolean;
  watched_at: string | null;
  created_at: string;
}

export type NewMovie = Omit<Movie, "id" | "watched" | "watched_at" | "created_at" | "ratings">;

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
