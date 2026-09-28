import { useEffect, useMemo, useState } from "react";
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, FieldPath, onSnapshot, orderBy, query,
  updateDoc, where, writeBatch, type Query,
} from "firebase/firestore";
import { db } from "./firebase";
import { firestoreMessage } from "./firestoreErrors";
import { normalizeMovie } from "./movies";
import { collectionFor, groupIdOf, mergeMovieLists, storedFields } from "./sharing";
import type { Movie, NewMovie } from "./types";

const RETRY_MS = 4000;

const refOf = (m: Pick<Movie, "id" | "shared_with">) => doc(db, collectionFor(m.shared_with), m.id);

interface Feed { movies: Movie[]; fromCache: boolean }

export function useMovies(enabled: boolean, me: string, groupIds: string[]) {
  const [feeds, setFeeds] = useState<Record<string, Feed>>({});
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const groupKey = [...groupIds].sort().join(",");
  const keys = useMemo(() => ["all", "mine", ...(groupKey ? groupKey.split(",").map((g) => `group:${g}`) : [])], [groupKey]);

  useEffect(() => {
    if (!enabled) return;
    const restricted = collection(db, "restricted");
    // Rules only allow queries that are limited to what you may see: everyone's movies,
    // the ones you own, and each of your groups' movies.
    const feedsToWatch: { key: string; q: Query; source: "movies" | "restricted" }[] = [
      { key: "all", q: query(collection(db, "movies"), orderBy("created_at", "desc")), source: "movies" },
      { key: "mine", q: query(restricted, where("owner", "==", me)), source: "restricted" },
      ...keys.slice(2).map((key) => ({ key, q: query(restricted, where("group_id", "==", groupIdOf(key))), source: "restricted" as const })),
    ];
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribes = feedsToWatch.map(({ key, q, source }) => onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => setFeeds((cur) => ({ ...cur, [key]: { movies: snap.docs.map((d) => normalizeMovie(d.id, d.data(), source)), fromCache: snap.metadata.fromCache } })),
      () => {
        // A read failure isn't a write failure, so it stays out of the "didn't save" banner. The sync dot
        // shows "Connecting…" and everything resubscribes shortly, so restored access recovers without a reload.
        setFeeds((cur) => ({ ...cur, [key]: { movies: cur[key]?.movies ?? [], fromCache: true } }));
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => setRetryTick((t) => t + 1), RETRY_MS);
      },
    ));
    return () => { clearTimeout(retryTimer); unsubscribes.forEach((u) => u()); };
  }, [enabled, me, keys, retryTick]);

  const movies = useMemo(() => mergeMovieLists(keys.map((k) => feeds[k]?.movies ?? [])), [feeds, keys]);
  const loading = !keys.every((k) => feeds[k]);
  const live = keys.every((k) => feeds[k] && !feeds[k].fromCache);

  const run = async (p: Promise<unknown>) => {
    try { await p; setError(null); }
    catch (e) {
      const message = firestoreMessage(e);
      setError(message);
      throw new Error(message);
    }
  };

  const add = (movie: NewMovie, sharedWith: string) => {
    const fields = { ...movie, watched: false, watched_at: null, created_at: new Date().toISOString() };
    return sharedWith === "all"
      ? run(addDoc(collection(db, "movies"), fields))
      : run(addDoc(collection(db, "restricted"), { ...fields, owner: me, group_id: groupIdOf(sharedWith) }));
  };

  const update = (m: Movie, patch: Partial<Omit<Movie, "id" | "shared_with" | "owner">>) => run(updateDoc(refOf(m), patch));

  const setWatched = (m: Movie, watched: boolean) =>
    update(m, { watched, watched_at: watched ? new Date().toISOString() : null });

  const remove = (m: Movie) => run(deleteDoc(refOf(m)));

  const addTag = (m: Movie, tag: string) => run(updateDoc(refOf(m), { tags: arrayUnion(tag) }));
  const removeTag = (m: Movie, tag: string) => run(updateDoc(refOf(m), { tags: arrayRemove(tag) }));

  // Emails contain dots, so the rating's key has to be a FieldPath rather than "ratings.<email>".
  const rate = (m: Movie, stars: number | null) =>
    run(updateDoc(refOf(m), new FieldPath("ratings", me), stars ?? deleteField()));

  // Between private and a group it's one field; to or from "everyone" the movie moves collections,
  // keeping its id, ratings and tags.
  const share = (m: Movie, sharedWith: string) => {
    if (sharedWith === m.shared_with) return Promise.resolve();
    if (collectionFor(m.shared_with) === "restricted" && collectionFor(sharedWith) === "restricted") {
      return run(updateDoc(refOf(m), { group_id: groupIdOf(sharedWith) }));
    }
    const batch = writeBatch(db);
    batch.delete(refOf(m));
    batch.set(doc(db, collectionFor(sharedWith), m.id), storedFields(m, sharedWith, me));
    return run(batch.commit());
  };

  return { movies, loading, error, live, add, update, setWatched, remove, addTag, removeTag, rate, share, clearError: () => setError(null) };
}
