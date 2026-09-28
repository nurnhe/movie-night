import { useRef, useState } from "react";
import { formatRuntime, MAX_TAG_LENGTH, MAX_TAGS, normalizeTag } from "../lib/filters";
import { imdbUrl, letterboxdUrl, posterUrl } from "../lib/tmdb";
import type { Movie } from "../lib/types";

interface Props {
  movie: Movie;
  highlighted: boolean;
  onWatched: (watched: boolean) => void;
  onDelete: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function MovieCard({ movie: m, highlighted, onWatched, onDelete, onAddTag, onRemoveTag }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [draft, setDraft] = useState("");
  const cancelled = useRef(false);

  function commitTag() {
    const tag = normalizeTag(draft);
    setDraft("");
    setTagging(false);
    if (cancelled.current) { cancelled.current = false; return; }
    const existing = [...m.genres.map((g) => g.toLowerCase()), ...m.tags];
    if (tag && !existing.includes(tag) && m.tags.length < MAX_TAGS) onAddTag(tag);
  }

  const poster = posterUrl(m.poster_path);
  return (
    <article className={"movie" + (highlighted ? " highlight" : "")}>
      {poster ? <img className="poster" src={poster} alt="" loading="lazy" width={72} height={108} /> : <div className="poster poster-ph" aria-hidden="true">{m.title.slice(0, 1)}</div>}
      <div className="movie-body">
        <h3>{m.title}{m.year && <span className="yr">{m.year}</span>}</h3>
        <div className="meta">
          {m.rating != null && <span className="rating" title={`${m.vote_count ?? 0} votes on TMDB`}>★ {m.rating.toFixed(1)}</span>}
          {m.runtime != null && <span className="runtime">{formatRuntime(m.runtime)}</span>}
          {m.genres.map((g) => <span key={g} className="tag">{g}</span>)}
          {m.tags.map((t) => (
            <span key={`tag:${t}`} className="tag custom">
              {t}
              <button type="button" className="tag-x" aria-label={`Remove tag ${t}`} onClick={() => onRemoveTag(t)}>×</button>
            </span>
          ))}
          {tagging ? (
            <input className="tag-input" type="text" autoFocus list="tag-suggestions" maxLength={MAX_TAG_LENGTH}
              aria-label={`New tag for ${m.title}`} placeholder="new tag" value={draft}
              onChange={(e) => setDraft(e.target.value)} onBlur={commitTag}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                if (e.key === "Escape") { cancelled.current = true; e.currentTarget.blur(); }
              }} />
          ) : m.tags.length < MAX_TAGS && (
            <button type="button" className="tag-add" aria-label={`Add a tag to ${m.title}`} onClick={() => setTagging(true)}>+ Tag</button>
          )}
          {m.watched && m.watched_at && <span className="pill good">Watched {new Date(m.watched_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>}
        </div>
        {m.note && <p className="note">“{m.note}”{m.added_by && <span className="muted"> · {m.added_by.split("@")[0]}</span>}</p>}
        {!m.note && m.added_by && <p className="note muted">Added by {m.added_by.split("@")[0]}</p>}
        <div className="links">
          {m.tmdb_id && <a href={letterboxdUrl(m.tmdb_id)} target="_blank" rel="noreferrer">Letterboxd</a>}
          {m.imdb_id && <a href={imdbUrl(m.imdb_id)} target="_blank" rel="noreferrer">IMDb</a>}
        </div>
      </div>
      <div className="actions">
        {confirming ? (
          <>
            <button className="btn danger" onClick={onDelete}>Delete for everyone</button>
            <button className="btn" onClick={() => setConfirming(false)}>Keep</button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => onWatched(!m.watched)}>{m.watched ? "Move back to list" : "Mark watched"}</button>
            <button className="btn ghost danger" aria-label={`Delete ${m.title}`} onClick={() => setConfirming(true)}>Delete</button>
          </>
        )}
      </div>
    </article>
  );
}
