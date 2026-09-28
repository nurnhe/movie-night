import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, runTransaction, where } from "firebase/firestore";
import { db } from "./firebase";
import { applyMemberChanges, newMoviesOnly } from "./groupLogic";
import type { Group, Movie, Person } from "./types";

const groupsRef = collection(db, "groups");

// Everyone who can use the app. Empty until the rules allow members to list /members.
export function useMemberDirectory(enabled: boolean) {
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    getDocs(collection(db, "members")).then(
      (snap) => {
        if (!active) return;
        setPeople(snap.docs.map((d) => {
          const name = d.data().name;
          return { email: d.id.toLowerCase(), name: typeof name === "string" ? name : "" };
        }));
      },
      () => { /* older rules: fall back to people we already know from movies and groups */ },
    );
    return () => { active = false; };
  }, [enabled]);

  return people;
}

export function useGroups(me: string) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onSnapshot(
    query(groupsRef, where("members", "array-contains", me)),
    (snap) => {
      setGroups(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Group).sort((a, b) => a.name.localeCompare(b.name)));
      setError(null);
    },
    (err) => setError(err.message),
  ), [me]);

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

export const deleteGroup = (id: string) => deleteDoc(doc(groupsRef, id));

// Groups briefly had their own lists; move anything added there back into the shared list.
export async function moveGroupMoviesToMainList(groupIds: string[], mainList: Pick<Movie, "tmdb_id" | "title">[]) {
  const known = [...mainList];
  for (const id of groupIds) {
    const snap = await getDocs(collection(db, "groups", id, "movies"));
    if (snap.empty) continue;
    const fresh = newMoviesOnly(known, snap.docs.map((d) => d.data() as Omit<Movie, "id">));
    await Promise.all(fresh.map((m) => addDoc(collection(db, "movies"), m)));
    known.push(...fresh);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
}
