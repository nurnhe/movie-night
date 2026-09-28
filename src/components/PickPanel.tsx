import { formatRuntime } from "../lib/filters";
import { letterboxdUrl, posterUrl } from "../lib/tmdb";
import type { Movie } from "../lib/types";

interface Props {
  pick: Movie | null;
  poolSize: number;
  onRoll: () => void;
  onWatched: () => void;
}

export function PickPanel({ pick, poolSize, onRoll, onWatched }: Props) {
  const poster = pick && posterUrl(pick.poster_path, "w342");
  return (
    <section className="ticket" aria-live="polite">
      {poster && <img className="ticket-poster" src={poster} alt="" />}
      <div className="ticket-main">
        <div className="eyebrow">Tonight's pick</div>
        {pick ? (
          <>
            <div className="pick-title" key={pick.id}>{pick.title}</div>
            <div className="pick-meta">
              {[pick.year, pick.rating != null && `★ ${pick.rating.toFixed(1)}`, formatRuntime(pick.runtime), [...pick.genres, ...pick.tags].join(", ")].filter(Boolean).join(" · ")}
            </div>
            {pick.overview && <p className="pick-overview">{pick.overview}</p>}
            {pick.tmdb_id && <a className="ticket-link" href={letterboxdUrl(pick.tmdb_id)} target="_blank" rel="noreferrer">Open on Letterboxd</a>}
          </>
        ) : (
          <>
            <div className="pick-title">Can't decide?</div>
            <div className="pick-meta">Set the filters below, then roll for a random movie from your list.</div>
          </>
        )}
      </div>
      <div className="stub">
        <button className="btn" onClick={onRoll} disabled={!poolSize}>{pick ? "Pick another" : "Pick a movie"}</button>
        {pick && <button className="btn alt" onClick={onWatched}>We watched it</button>}
        <div className="count">{poolSize} {poolSize === 1 ? "movie matches" : "movies match"}</div>
      </div>
    </section>
  );
}
