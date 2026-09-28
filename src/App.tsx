import { useEffect, useMemo, useState } from "react";
import { isSignInWithEmailLink, onAuthStateChanged, signInWithEmailLink, signOut as firebaseSignOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured, SIGNIN_EMAIL_KEY } from "./lib/firebase";
import { useMovies } from "./lib/useMovies";
import { emptyFilters, matchesFilters, pickRandom, sortMovies, type Filters, type SortKey } from "./lib/filters";
import { SignIn } from "./components/SignIn";
import { AddMovie } from "./components/AddMovie";
import { FiltersBar } from "./components/FiltersBar";
import { MovieCard } from "./components/MovieCard";
import { PickPanel } from "./components/PickPanel";

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    if (!firebaseConfigured) return;
    const unsubscribe = onAuthStateChanged(auth, setUser);
    const href = window.location.href;
    if (isSignInWithEmailLink(auth, href)) {
      let email: string | null = null;
      try { email = localStorage.getItem(SIGNIN_EMAIL_KEY); } catch { /* storage unavailable */ }
      email ??= window.prompt("Confirm the email you used to sign in");
      window.history.replaceState(null, "", window.location.pathname);
      if (email) {
        signInWithEmailLink(auth, email.trim(), href)
          .then(() => { try { localStorage.removeItem(SIGNIN_EMAIL_KEY); } catch { /* storage unavailable */ } })
          .catch((e) => setLinkError(e instanceof Error ? e.message : "That sign-in link didn't work. Send a new one."));
      }
    }
    return unsubscribe;
  }, []);

  if (!firebaseConfigured) return <Setup />;
  if (user === undefined) return null;
  if (!user) return <SignIn key={linkError} initialError={linkError} />;
  return <Queue email={user.email ?? ""} />;
}

function Setup() {
  return (
    <main className="signin">
      <h1 className="brand">Movie Night <span>Queue</span></h1>
      <p className="lede">This copy of the app isn't connected to a database yet. Add the <code>VITE_FIREBASE_*</code> settings as described in the README, then rebuild.</p>
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
    if (!email) { setMember(false); return; }
    getDoc(doc(db, "members", email.toLowerCase())).then((snap) => setMember(snap.exists()), () => setMember(false));
  }, [email]);
  useEffect(() => { try { localStorage.setItem("mnq-filters", JSON.stringify(filters)); } catch { /* storage unavailable */ } }, [filters]);

  const genres = useMemo(() => [...new Set(movies.flatMap((m) => m.genres))].sort(), [movies]);
  const people = useMemo(() => [...new Set(movies.map((m) => m.added_by).filter((p): p is string => !!p))].sort(), [movies]);
  const pool = useMemo(() => movies.filter((m) => !m.watched && matchesFilters(m, filters)), [movies, filters]);
  const todo = movies.filter((m) => !m.watched);
  const done = movies.filter((m) => m.watched);
  const shown = sortMovies((tab === "todo" ? todo : done).filter((m) => matchesFilters(m, filters)), sort);
  const pick = movies.find((m) => m.id === pickId && !m.watched) ?? null;

  const signOut = () => firebaseSignOut(auth);
  const safe = (p: Promise<unknown>) => p.catch(() => { /* surfaced through error */ });

  if (member === false) {
    return (
      <main className="signin">
        <h1 className="brand">Movie Night <span>Queue</span></h1>
        <p className="lede">You're signed in as <strong>{email}</strong>, but this email isn't on the list of people who share it. Ask the owner to add it to the members collection in Firebase.</p>
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
