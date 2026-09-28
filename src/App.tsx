import { useEffect, useMemo, useState } from "react";
import { isSignInWithEmailLink, onAuthStateChanged, sendEmailVerification, signInWithEmailLink, signOut as firebaseSignOut, type User } from "firebase/auth";
import { auth, firebaseConfigured, SIGNIN_EMAIL_KEY } from "./lib/firebase";
import { authMessage } from "./lib/authErrors";
import { useGroups, useOriginalList } from "./lib/groups";
import type { Group } from "./lib/types";
import { useMovies } from "./lib/useMovies";
import { emptyFilters, matchesFilters, pickRandom, sortMovies, type Filters, type SortKey } from "./lib/filters";
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

const GROUP_KEY = "mnq-group";
const NEW_GROUP = "__new";

function loadFilters(groupId: string): Filters {
  try { return { ...emptyFilters, ...JSON.parse(localStorage.getItem(`mnq-filters-${groupId}`) ?? "{}") }; } catch { return emptyFilters; }
}

type DialogState = { kind: "create" } | { kind: "edit"; group: Group } | null;

function Queue({ email }: { email: string }) {
  const me = email.toLowerCase();
  const { groups, error } = useGroups(me);
  const originalList = useOriginalList(me);
  const [selectedId, setSelectedId] = useState<string | null>(() => { try { return localStorage.getItem(GROUP_KEY); } catch { return null; } });
  const [dialog, setDialog] = useState<DialogState>(null);
  const group = groups?.find((g) => g.id === selectedId) ?? groups?.[0] ?? null;

  const select = (id: string) => {
    setSelectedId(id);
    try { localStorage.setItem(GROUP_KEY, id); } catch { /* storage unavailable */ }
  };
  const signOut = () => firebaseSignOut(auth);

  let content;
  if (error) {
    content = (
      <main className="signin">
        <h1 className="brand">Movie Night <span>Queue</span></h1>
        <p className="error">Couldn't load your groups: {error}</p>
        <button className="btn" onClick={() => window.location.reload()}>Try again</button>
        <p className="muted small"><button className="linklike" onClick={signOut}>Sign out</button></p>
      </main>
    );
  } else if (!groups) {
    content = <main className="signin"><h1 className="brand">Movie Night <span>Queue</span></h1><p className="muted">Loading your groups…</p></main>;
  } else if (!group) {
    content = (
      <main className="signin">
        <h1 className="brand">Movie Night <span>Queue</span></h1>
        <p className="lede">You're not in a group yet. Create one and add the people you watch with. Each group has its own list.</p>
        <button className="btn primary" onClick={() => setDialog({ kind: "create" })}>Create a group</button>
        <p className="muted small">If someone adds <strong>{email}</strong> to their group, it shows up here right away.</p>
        <p className="muted small"><button className="linklike" onClick={signOut}>Sign out</button></p>
      </main>
    );
  } else {
    content = (
      <GroupList key={group.id} group={group} groups={groups} email={email} onSignOut={signOut}
        onSelect={select} onNewGroup={() => setDialog({ kind: "create" })} onSettings={() => setDialog({ kind: "edit", group })} />
    );
  }

  // The dialog stays the second child so it isn't remounted when the page behind it changes.
  return (
    <>
      {content}
      {dialog && (
        <GroupDialog group={dialog.kind === "edit" ? dialog.group : null} me={me} originalList={originalList}
          firstGroup={!groups?.length} onCreated={select} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

interface GroupListProps {
  group: Group;
  groups: Group[];
  email: string;
  onSelect: (id: string) => void;
  onNewGroup: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}

function GroupList({ group, groups, email, onSelect, onNewGroup, onSettings, onSignOut }: GroupListProps) {
  const { movies, loading, error, live, add, setWatched, remove, clearError } = useMovies(group.id);
  const [filters, setFilters] = useState<Filters>(() => loadFilters(group.id));
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [sort, setSort] = useState<SortKey>("added");
  const [pickId, setPickId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => { try { localStorage.setItem(`mnq-filters-${group.id}`, JSON.stringify(filters)); } catch { /* storage unavailable */ } }, [group.id, filters]);

  const genres = useMemo(() => [...new Set(movies.flatMap((m) => m.genres))].sort(), [movies]);
  const people = useMemo(() => [...new Set(movies.map((m) => m.added_by).filter((p): p is string => !!p))].sort(), [movies]);
  const pool = useMemo(() => movies.filter((m) => !m.watched && matchesFilters(m, filters)), [movies, filters]);
  const todo = movies.filter((m) => !m.watched);
  const done = movies.filter((m) => m.watched);
  const shown = sortMovies((tab === "todo" ? todo : done).filter((m) => matchesFilters(m, filters)), sort);
  const pick = movies.find((m) => m.id === pickId && !m.watched) ?? null;
  const others = group.members.length - 1;

  const safe = (p: Promise<unknown>) => p.catch(() => { /* surfaced through error */ });

  return (
    <div className="wrap">
      <header className="top">
        <h1 className="brand">Movie Night <span>Queue</span></h1>
        <div className="top-right">
          <span className="sync"><span className={"dot" + (live ? " live" : "")} />{live ? "Synced" : "Connecting…"}</span>
          <button className="btn ghost small" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <div className="groupbar">
        <select aria-label="Group" value={group.id} onChange={(e) => (e.target.value === NEW_GROUP ? onNewGroup() : onSelect(e.target.value))}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          <option value={NEW_GROUP}>+ New group…</option>
        </select>
        <span className="muted small">{others ? `You and ${others} other${others === 1 ? "" : "s"}` : "Just you"}</span>
        <button className="btn ghost small" onClick={onSettings}>Group settings</button>
      </div>

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
          {loading ? (
            <p className="muted">Loading your list…</p>
          ) : shown.length ? (
            shown.map((m) => (
              <MovieCard key={m.id} movie={m} highlighted={m.id === pickId}
                onWatched={(w) => safe(setWatched(m, w))} onDelete={() => safe(remove(m.id))} />
            ))
          ) : (
            <div className="empty">
              <strong>{!movies.length ? "This list is empty" : tab === "done" && !done.length ? "Nothing watched yet" : "No movies match these filters"}</strong>
              {!movies.length ? (others ? "Add the first movie you want to see. It shows up for everyone in the group right away." : "Add a movie, or open Group settings to invite people.")
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
