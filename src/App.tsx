import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { useMovies } from "./lib/useMovies";
import { emptyFilters, matchesFilters, pickRandom, sortMovies, type Filters, type SortKey } from "./lib/filters";
import { SignIn } from "./components/SignIn";
import { AddMovie } from "./components/AddMovie";
import { FiltersBar } from "./components/FiltersBar";
import { MovieCard } from "./components/MovieCard";
import { PickPanel } from "./components/PickPanel";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) return <Setup />;
  if (session === undefined) return null;
  if (!session) return <SignIn />;
  return <Queue email={session.user.email ?? ""} />;
}

function Setup() {
  return (
    <main className="signin">
      <h1 className="brand">Movie Night <span>Queue</span></h1>
      <p className="lede">This copy of the app isn't connected to a database yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> as described in the README, then rebuild.</p>
    </main>
  );
}

function loadFilters(): Filters {
  try { return { ...emptyFilters, ...JSON.parse(localStorage.getItem("mnq-filters") ?? "{}") }; } catch { return emptyFilters; }
}

function Queue({ email }: { email: string }) {
  const [member, setMember] = useState<boolean | null>(null);
  const { movies, loading, error, live, add, setWatched, remove, clearError } = useMovies(member === true);
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [sort, setSort] = useState<SortKey>("added");
  const [pickId, setPickId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    supabase.from("members").select("email").then(({ data, error }) => setMember(!error && (data?.length ?? 0) > 0));
  }, []);
  useEffect(() => { try { localStorage.setItem("mnq-filters", JSON.stringify(filters)); } catch { /* storage unavailable */ } }, [filters]);

  const genres = useMemo(() => [...new Set(movies.flatMap((m) => m.genres))].sort(), [movies]);
  const people = useMemo(() => [...new Set(movies.map((m) => m.added_by).filter((p): p is string => !!p))].sort(), [movies]);
  const pool = useMemo(() => movies.filter((m) => !m.watched && matchesFilters(m, filters)), [movies, filters]);
  const todo = movies.filter((m) => !m.watched);
  const done = movies.filter((m) => m.watched);
  const shown = sortMovies((tab === "todo" ? todo : done).filter((m) => matchesFilters(m, filters)), sort);
  const pick = movies.find((m) => m.id === pickId && !m.watched) ?? null;

  const signOut = () => supabase.auth.signOut();
  const safe = (p: Promise<unknown>) => p.catch(() => { /* surfaced through error */ });

  if (member === false) {
    return (
      <main className="signin">
        <h1 className="brand">Movie Night <span>Queue</span></h1>
        <p className="lede">You're signed in as <strong>{email}</strong>, but this email isn't on the list of people who share it. Ask the owner to add it in Supabase.</p>
        <button className="btn" onClick={signOut}>Sign out</button>
      </main>
    );
  }

  return (
    <div className="wrap">
      <header className="top">
        <h1 className="brand">Movie Night <span>Queue</span></h1>
        <div className="top-right">
          <span className="sync"><span className={"dot" + (live ? " live" : "")} />{live ? "Synced" : "Connecting…"}</span>
          <button className="btn ghost small" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {error && <div className="banner" role="alert">That didn't save: {error} <button className="linklike" onClick={clearError}>Dismiss</button></div>}

      <PickPanel
        pick={pick}
        poolSize={pool.length}
        onRoll={() => setPickId(pickRandom(pool, pickId)?.id ?? null)}
        onWatched={() => pick && safe(setWatched(pick, true))}
      />

      <FiltersBar filters={filters} onChange={setFilters} genres={genres} people={people} />

      <section className="list-section">
        <div className="listhead">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "todo"} onClick={() => setTab("todo")}>To watch <span className="n">{todo.length}</span></button>
            <button role="tab" aria-selected={tab === "done"} onClick={() => setTab("done")}>Watched <span className="n">{done.length}</span></button>
          </div>
          <div className="listhead-right">
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="added">{tab === "done" ? "Recently watched" : "Recently added"}</option>
              <option value="rating">Highest rated</option>
              <option value="runtime">Shortest first</option>
              <option value="year">Newest release</option>
              <option value="title">Title A–Z</option>
            </select>
            <button className="btn primary" onClick={() => setAdding(true)}>Add a movie</button>
          </div>
        </div>

        <div className="list">
          {loading || member === null ? (
            <p className="muted">Loading your list…</p>
          ) : shown.length ? (
            shown.map((m) => (
              <MovieCard key={m.id} movie={m} highlighted={m.id === pickId}
                onWatched={(w) => safe(setWatched(m, w))} onDelete={() => safe(remove(m.id))} />
            ))
          ) : (
            <div className="empty">
              <strong>{!movies.length ? "Your list is empty" : tab === "done" && !done.length ? "Nothing watched yet" : "No movies match these filters"}</strong>
              {!movies.length ? "Add the first movie you both want to see. It shows up for the other person right away."
                : tab === "done" && !done.length ? "Mark a movie as watched and it moves here."
                : <>Try a longer length or fewer genres. <button className="linklike" onClick={() => setFilters(emptyFilters)}>Clear filters</button></>}
            </div>
          )}
        </div>
      </section>

      <footer className="foot muted small">Movie details and ratings from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</footer>

      {adding && <AddMovie existing={movies} userEmail={email} onAdd={add} onClose={() => setAdding(false)} />}
    </div>
  );
}
