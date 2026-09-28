import { useEffect, useMemo, useRef, useState } from "react";
import { isSignInWithEmailLink, onAuthStateChanged, sendEmailVerification, signInWithEmailLink, signOut as firebaseSignOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured, SIGNIN_EMAIL_KEY } from "./lib/firebase";
import { authMessage } from "./lib/authErrors";
import { moveGroupMoviesToMainList, useGroups } from "./lib/groups";
import type { Group } from "./lib/types";
import { useMovies } from "./lib/useMovies";
import { allTags, emptyFilters, matchesFilters, pickRandom, scopeAdders, sortMovies, type Filters, type SortKey } from "./lib/filters";
import { SignIn } from "./components/SignIn";
import { AddMovie } from "./components/AddMovie";
import { GroupDialog } from "./components/GroupDialog";
import { FiltersBar } from "./components/FiltersBar";
import { MovieCard } from "./components/MovieCard";
import { PickPanel } from "./components/PickPanel";

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [verified, setVerified] = useState(false);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    if (!firebaseConfigured) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setVerified(!!u?.emailVerified); });
    const href = window.location.href;
    if (isSignInWithEmailLink(auth, href)) {
      let email: string | null = null;
      try { email = localStorage.getItem(SIGNIN_EMAIL_KEY); } catch { /* storage unavailable */ }
      email ??= window.prompt("Confirm the email you used to sign in");
      window.history.replaceState(null, "", window.location.pathname);
      if (email) {
        signInWithEmailLink(auth, email.trim(), href)
          .then(() => { try { localStorage.removeItem(SIGNIN_EMAIL_KEY); } catch { /* storage unavailable */ } })
          .catch((e) => setLinkError(authMessage(e)));
      }
    }
    return unsubscribe;
  }, []);

  if (!firebaseConfigured) return <Setup />;
  if (user === undefined) return null;
  if (!user) return <SignIn key={linkError} initialError={linkError} />;
  if (!verified) return <VerifyEmail user={user} onVerified={() => setVerified(true)} />;
  return <Queue email={user.email ?? ""} />;
}

function VerifyEmail({ user, onVerified }: { user: User; onVerified: () => void }) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [message, setMessage] = useState("");

  async function send() {
    setState("busy");
    setMessage("");
    try {
      await sendEmailVerification(user, { url: window.location.origin + window.location.pathname });
      setState("sent");
    } catch (e) {
      setMessage(authMessage(e));
      setState("idle");
    }
  }

  async function recheck() {
    setMessage("");
    try {
      await user.reload();
      if (!auth.currentUser?.emailVerified) {
        setMessage("Not verified yet. Click the link in the email first, then try again.");
        return;
      }
      await auth.currentUser.getIdToken(true); // the list's access rules read the verified flag from this token
      onVerified();
    } catch (e) {
      setMessage(authMessage(e));
    }
  }

  return (
    <main className="signin">
      <h1 className="brand">Movie Night <span>Queue</span></h1>
      <p className="lede">One more step: confirm that <strong>{user.email}</strong> is your email. You only need to do this once.</p>
      {state === "sent" && <p className="notice">Sent. Open the email, click the link, then come back here.</p>}
      <div className="signin-form">
        <button className="btn primary" onClick={send} disabled={state === "busy"}>
          {state === "busy" ? "Sending…" : state === "sent" ? "Send it again" : "Send verification email"}
        </button>
        <button className="btn" onClick={recheck}>I've clicked the link</button>
        {message && <p className="error">{message}</p>}
      </div>
      <p className="muted small"><button className="linklike" onClick={() => firebaseSignOut(auth)}>Sign out</button></p>
    </main>
  );
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

type DialogState = { kind: "create" } | { kind: "edit"; group: Group } | null;

function Queue({ email }: { email: string }) {
  const me = email.toLowerCase();
  const [access, setAccess] = useState<"checking" | "member" | "not-member" | "error">("checking");
  const [accessError, setAccessError] = useState("");
  const { movies, loading, error, live, add, setWatched, remove, addTag, removeTag, clearError } = useMovies(access === "member");
  const { groups } = useGroups(me);
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [sort, setSort] = useState<SortKey>("added");
  const [pickId, setPickId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const movedGroupMovies = useRef(false);

  useEffect(() => {
    getDoc(doc(db, "members", me)).then(
      (snap) => setAccess(snap.exists() ? "member" : "not-member"),
      (e) => { setAccessError(e instanceof Error ? e.message : String(e)); setAccess("error"); },
    );
  }, [me]);
  useEffect(() => { try { localStorage.setItem("mnq-filters", JSON.stringify(filters)); } catch { /* storage unavailable */ } }, [filters]);
  useEffect(() => {
    if (movedGroupMovies.current || access !== "member" || loading || !groups.length) return;
    movedGroupMovies.current = true;
    moveGroupMoviesToMainList(groups.map((g) => g.id), movies).catch(() => { /* tried again next visit */ });
  }, [access, loading, groups, movies]);

  const scope = filters.scope.startsWith("group:") && !groups.some((g) => `group:${g.id}` === filters.scope) ? "" : filters.scope;
  const adders = useMemo(() => scopeAdders(scope, me, groups), [scope, me, groups]);
  const knownEmails = useMemo(
    () => [me, ...movies.map((m) => m.added_by), ...groups.flatMap((g) => g.members)],
    [me, movies, groups],
  );
  // Keep selected tags visible even if no movie has them any more, so they can be turned off.
  const tags = useMemo(() => allTags([...movies, { genres: [], tags: filters.tags }]), [movies, filters.tags]);
  const customTags = useMemo(() => [...new Set(movies.flatMap((m) => m.tags))].sort(), [movies]);
  const pool = useMemo(() => movies.filter((m) => !m.watched && matchesFilters(m, filters, adders)), [movies, filters, adders]);
  const inScope = adders ? movies.filter((m) => matchesFilters(m, emptyFilters, adders)) : movies;
  const todo = inScope.filter((m) => !m.watched);
  const done = inScope.filter((m) => m.watched);
  const shown = sortMovies((tab === "todo" ? todo : done).filter((m) => matchesFilters(m, filters, adders)), sort);
  const pick = movies.find((m) => m.id === pickId && !m.watched) ?? null;

  const signOut = () => firebaseSignOut(auth);
  const safe = (p: Promise<unknown>) => p.catch(() => { /* surfaced through error */ });

  if (access !== "member") {
    return (
      <main className="signin">
        <h1 className="brand">Movie Night <span>Queue</span></h1>
        {access === "checking" && <p className="muted">Loading…</p>}
        {access === "not-member" && <p className="lede">You're signed in as <strong>{email}</strong>, but this email isn't on the list of people who share it. Ask the owner to add it to the members collection in Firebase.</p>}
        {access === "error" && (
          <>
            <p className="error">Couldn't check your access: {accessError}</p>
            <button className="btn" onClick={() => window.location.reload()}>Try again</button>
          </>
        )}
        {access !== "checking" && <button className="btn" onClick={signOut}>Sign out</button>}
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

      <FiltersBar filters={{ ...filters, scope }} onChange={setFilters} tags={tags} groups={groups}
        onNewGroup={() => setDialog({ kind: "create" })} onEditGroup={(group) => setDialog({ kind: "edit", group })} />

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
          {loading ? (
            <p className="muted">Loading your list…</p>
          ) : shown.length ? (
            shown.map((m) => (
              <MovieCard key={m.id} movie={m} highlighted={m.id === pickId}
                onWatched={(w) => safe(setWatched(m, w))} onDelete={() => safe(remove(m.id))}
                onAddTag={(t) => safe(addTag(m.id, t))} onRemoveTag={(t) => safe(removeTag(m.id, t))} />
            ))
          ) : (
            <div className="empty">
              <strong>{!movies.length ? "Your list is empty" : tab === "done" && !done.length ? "Nothing watched yet" : "No movies match these filters"}</strong>
              {!movies.length ? "Add the first movie you want to see. It shows up for everyone right away."
                : tab === "done" && !done.length ? "Mark a movie as watched and it moves here."
                : <>Try another “Show” option, a longer length or fewer tags. <button className="linklike" onClick={() => setFilters(emptyFilters)}>Clear filters</button></>}
            </div>
          )}
        </div>
      </section>

      <footer className="foot muted small">Movie details and ratings from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</footer>

      <datalist id="tag-suggestions">{customTags.map((t) => <option key={t} value={t} />)}</datalist>

      {adding && <AddMovie existing={movies} userEmail={email} onAdd={add} onClose={() => setAdding(false)} />}
      {dialog && (
        <GroupDialog group={dialog.kind === "edit" ? dialog.group : null} me={me} knownEmails={knownEmails}
          onCreated={(id) => setFilters((f) => ({ ...f, scope: `group:${id}` }))} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
