import { useEffect, useState } from "react";
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Movie, NewMovie } from "./types";

const moviesRef = collection(db, "movies");

export function useMovies(enabled: boolean) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(moviesRef, orderBy("created_at", "desc")),
      { includeMetadataChanges: true },
      (snap) => {
        setMovies(snap.docs.map((d) => {
          const data = d.data();
          // Older movies have no tags, and hand-written ones may lack genres.
          return { ...data, id: d.id, genres: Array.isArray(data.genres) ? data.genres : [], tags: Array.isArray(data.tags) ? data.tags : [] } as Movie;
        }));
        setLive(!snap.metadata.fromCache);
        setLoading(false);
      },
      (err) => { setError(err.message); setLive(false); setLoading(false); },
    );
  }, [enabled]);

  const run = async (p: Promise<unknown>) => {
    try { await p; setError(null); }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw new Error(message);
    }
  };

  const add = (movie: NewMovie) =>
    run(addDoc(moviesRef, { ...movie, watched: false, watched_at: null, created_at: new Date().toISOString() }));

  const update = (id: string, patch: Partial<Omit<Movie, "id">>) => run(updateDoc(doc(moviesRef, id), patch));

  const setWatched = (m: Movie, watched: boolean) =>
    update(m.id, { watched, watched_at: watched ? new Date().toISOString() : null });

  const remove = (id: string) => run(deleteDoc(doc(moviesRef, id)));

  const addTag = (id: string, tag: string) => run(updateDoc(doc(moviesRef, id), { tags: arrayUnion(tag) }));
  const removeTag = (id: string, tag: string) => run(updateDoc(doc(moviesRef, id), { tags: arrayRemove(tag) }));

  return { movies, loading, error, live, add, update, setWatched, remove, addTag, removeTag, clearError: () => setError(null) };
}
