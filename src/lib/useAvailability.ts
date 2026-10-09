import { useEffect, useRef, useState } from "react";
import { availabilityKey, isFresh, titlesToCheck, type AvailabilityCache } from "./availability";
import { tmdbConfigured, watchProviders } from "./tmdb";
import type { Movie } from "./types";

const STORAGE_KEY = "mnq-availability";
const PAUSE_MS = 150;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function load(): AvailabilityCache {
  try {
    const now = Date.now();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as AvailabilityCache;
    return Object.fromEntries(Object.entries(saved).filter(([, c]) => isFresh(c, now)));
  } catch { return {}; }
}

function save(cache: AvailabilityCache) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch { /* storage unavailable */ }
}

// Looks up where each unwatched title streams (see availability.ts) and keeps the answers for a day in this
// browser only. A failed lookup shows nothing for that title rather than an error.
export function useAvailability(ready: boolean, movies: Movie[]): AvailabilityCache {
  const [cache, setCache] = useState<AvailabilityCache>(load);
  const latest = useRef({ movies, cache });
  latest.current = { movies, cache };
  const attempted = useRef(new Set<string>());

  // Re-run when the set of unwatched titles changes, not on every live update.
  const wanted = movies.filter((m) => !m.watched).map(availabilityKey).filter(Boolean).sort().join(",");

  useEffect(() => {
    if (!ready || !tmdbConfigured) return;
    let cancelled = false;
    (async () => {
      const { movies: list, cache: known } = latest.current;
      for (const m of titlesToCheck(list, known, Date.now())) {
        if (cancelled) return;
        const key = availabilityKey(m) as string;
        if (attempted.current.has(key)) continue;
        attempted.current.add(key);
        try {
          const found = await watchProviders(m.tmdb_id as number, m.media_type);
          setCache((c) => {
            const next = { ...c, [key]: { ...found, at: Date.now() } };
            save(next);
            return next;
          });
        } catch { /* leave this title without a badge */ }
        await sleep(PAUSE_MS);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, wanted]);

  return cache;
}
