export interface Movie {
  id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  year: number | null;
  runtime: number | null;
  genres: string[];
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

export type NewMovie = Omit<Movie, "id" | "watched" | "watched_at" | "created_at">;
