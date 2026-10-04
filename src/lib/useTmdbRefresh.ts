import { useEffect, useRef } from "react";
import { titleDetails, tmdbConfigured, TmdbError } from "./tmdb";
import { mustPurge, purgePatch, refreshPatch, staleTitles } from "./tmdbCache";
import type { Movie } from "./types";

const PAUSE_MS = 250;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Keeps TMDB-sourced fields younger than TMDB's 6-month caching limit by re-fetching a batch of
// the oldest titles each visit. Failures are quiet and leave stored data as it was; the one exception is a
// title TMDB no longer has once its data is too old to keep.
export function useTmdbRefresh(ready: boolean, movies: Movie[], apply: (m: Movie, patch: Record<string, unknown>) => Promise<unknown>) {
  const latest = useRef(movies);
  latest.current = movies;
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    if (!ready || !tmdbConfigured) return;
    let cancelled = false;
    (async () => {
      const now = Date.now();
      for (const m of staleTitles(latest.current, now)) {
        if (cancelled) return;
        if (attempted.current.has(m.id)) continue;
        attempted.current.add(m.id);
        try {
          const details = await titleDetails(m.tmdb_id as number, m.media_type);
          await apply(m, refreshPatch(details, new Date().toISOString()));
        } catch (e) {
          if (e instanceof TmdbError && e.status === 404 && mustPurge(m, now)) await apply(m, purgePatch).catch(() => { /* retried next visit */ });
        }
        await sleep(PAUSE_MS);
      }
    })();
    return () => { cancelled = true; };
    // Runs when the list becomes ready, not on every live update (`apply` is a new function each render).
  }, [ready]);
}
