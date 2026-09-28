import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Movie, NewMovie } from "./types";

export function useMovies(enabled: boolean) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("movies").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    else { setMovies(data as Movie[]); setError(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    const channel = supabase
      .channel("movies-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "movies" }, (payload) => {
        setMovies((cur) => {
          if (payload.eventType === "DELETE") return cur.filter((m) => m.id !== (payload.old as Movie).id);
          const row = payload.new as Movie;
          const i = cur.findIndex((m) => m.id === row.id);
          if (i === -1) return [row, ...cur];
          const next = [...cur];
          next[i] = row;
          return next;
        });
      })
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") load(); // catch anything missed while reconnecting
      });
    return () => { supabase.removeChannel(channel); };
  }, [enabled, load]);

  const run = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => {
    const { data, error } = await p;
    if (error) { setError(error.message); throw new Error(error.message); }
    setError(null);
    return data;
  };

  const upsertLocal = (row: Movie) =>
    setMovies((cur) => (cur.some((m) => m.id === row.id) ? cur.map((m) => (m.id === row.id ? row : m)) : [row, ...cur]));

  const add = async (movie: NewMovie) => upsertLocal(await run(supabase.from("movies").insert(movie).select().single()) as Movie);

  const update = async (id: string, patch: Partial<Movie>) =>
    upsertLocal(await run(supabase.from("movies").update(patch).eq("id", id).select().single()) as Movie);

  const setWatched = (m: Movie, watched: boolean) =>
    update(m.id, { watched, watched_at: watched ? new Date().toISOString() : null });

  const remove = async (id: string) => {
    await run(supabase.from("movies").delete().eq("id", id));
    setMovies((cur) => cur.filter((m) => m.id !== id));
  };

  return { movies, loading, error, live, add, update, setWatched, remove, clearError: () => setError(null) };
}
