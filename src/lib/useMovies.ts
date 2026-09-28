import { useEffect, useState } from "react";
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, FieldPath, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { firestoreMessage } from "./firestoreErrors";
import { normalizeMovie } from "./movies";
import type { Movie, NewMovie } from "./types";

const moviesRef = collection(db, "movies");
const RETRY_MS = 4000;

export function useMovies(enabled: boolean) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onSnapshot(
      query(moviesRef, orderBy("created_at", "desc")),
      { includeMetadataChanges: true },
      (snap) => {
        setMovies(snap.docs.map((d) => normalizeMovie(d.id, d.data())));
        setLive(!snap.metadata.fromCache);
        setLoading(false);
      },
      () => {
        // A subscribe/read failure isn't a write failure, so it doesn't belong in the "didn't save" banner.
        // The sync dot already shows "Connecting…"; retry quietly so access restored elsewhere (e.g. re-added
        // to members) recovers the list without needing a reload.
        setLive(false);
        setLoading(false);
        retryTimer = setTimeout(() => setRetryTick((t) => t + 1), RETRY_MS);
      },
    );
    return () => { clearTimeout(retryTimer); unsubscribe(); };
  }, [enabled, retryTick]);

  const run = async (p: Promise<unknown>) => {
    try { await p; setError(null); }
    catch (e) {
      const message = firestoreMessage(e);
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

  // Emails contain dots, so the rating's key has to be a FieldPath rather than "ratings.<email>".
  const rate = (id: string, email: string, stars: number | null) =>
    run(updateDoc(doc(moviesRef, id), new FieldPath("ratings", email), stars ?? deleteField()));

  return { movies, loading, error, live, add, update, setWatched, remove, addTag, removeTag, rate, clearError: () => setError(null) };
}
