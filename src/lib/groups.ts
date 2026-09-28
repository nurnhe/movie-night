import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, where } from "firebase/firestore";
import { db } from "./firebase";
import { applyMemberChanges, newMoviesOnly } from "./groupLogic";
import type { Group, Movie } from "./types";

export type StoredMovie = Omit<Movie, "id">;

const groupsRef = collection(db, "groups");
export const groupMovies = (groupId: string) => collection(db, "groups", groupId, "movies");

export function useGroups(me: string) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A just-created group shows up locally before the server has it, and the movie rules
    // look the group up on the server, so only surface groups the server has confirmed.
    const confirmed = new Set<string>();
    return onSnapshot(
      query(groupsRef, where("members", "array-contains", me)),
      { includeMetadataChanges: true },
      (snap) => {
        for (const d of snap.docs) if (!d.metadata.hasPendingWrites) confirmed.add(d.id);
        setGroups(snap.docs
          .filter((d) => confirmed.has(d.id))
          .map((d) => ({ ...d.data(), id: d.id }) as Group)
          .sort((a, b) => a.name.localeCompare(b.name)));
        setError(null);
      },
      (err) => setError(err.message),
    );
  }, [me]);

  return { groups, error };
}

export async function createGroup(name: string, others: string[], me: string): Promise<string> {
  const ref = await addDoc(groupsRef, {
    name,
    members: [...new Set([me, ...others])],
    created_by: me,
    created_at: new Date().toISOString(),
  });
  return ref.id;
}

export function updateGroup(id: string, patch: { name?: string; added?: string[]; removed?: string[] }) {
  return runTransaction(db, async (tx) => {
    const ref = doc(groupsRef, id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("This group no longer exists.");
    const members = applyMemberChanges(snap.data().members as string[], patch.added ?? [], patch.removed ?? []);
    tx.update(ref, patch.name === undefined ? { members } : { name: patch.name, members });
  });
}

export async function deleteGroup(id: string) {
  const movies = await getDocs(groupMovies(id));
  await Promise.all(movies.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(groupsRef, id));
}

export async function copyMoviesInto(groupId: string, movies: StoredMovie[]): Promise<number> {
  const existing = await getDocs(groupMovies(groupId));
  const fresh = newMoviesOnly(existing.docs.map((d) => d.data() as StoredMovie), movies);
  await Promise.all(fresh.map((m) => addDoc(groupMovies(groupId), m)));
  return fresh.length;
}

// The single shared list from before groups existed; readable only by people in /members.
export function useOriginalList(me: string) {
  const [movies, setMovies] = useState<StoredMovie[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const member = await getDoc(doc(db, "members", me));
      if (!member.exists()) return;
      const snap = await getDocs(collection(db, "movies"));
      if (active) setMovies(snap.docs.map((d) => d.data() as StoredMovie));
    })().catch(() => { /* no original list to offer */ });
    return () => { active = false; };
  }, [me]);

  return movies;
}
