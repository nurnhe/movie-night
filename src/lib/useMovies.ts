import { useEffect, useState } from "react";
import { addDoc, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { groupMovies } from "./groups";
import type { Movie, NewMovie } from "./types";

export function useMovies(groupId: string) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => onSnapshot(
    query(groupMovies(groupId), orderBy("created_at", "desc")),
    { includeMetadataChanges: true },
    (snap) => {
      setMovies(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Movie));
      setLive(!snap.metadata.fromCache);
      setLoading(false);
    },
    (err) => { setError(err.message); setLive(false); setLoading(false); },
  ), [groupId]);

  const run = async (p: Promise<unknown>) => {
    try { await p; setError(null); }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw new Error(message);
    }
  };

  const ref = groupMovies(groupId);

  const add = (movie: NewMovie) =>
    run(addDoc(ref, { ...movie, watched: false, watched_at: null, created_at: new Date().toISOString() }));

  const update = (id: string, patch: Partial<Omit<Movie, "id">>) => run(updateDoc(doc(ref, id), patch));

  const setWatched = (m: Movie, watched: boolean) =>
    update(m.id, { watched, watched_at: watched ? new Date().toISOString() : null });

  const remove = (id: string) => run(deleteDoc(doc(ref, id)));

  return { movies, loading, error, live, add, update, setWatched, remove, clearError: () => setError(null) };
}
