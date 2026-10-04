import { formatRuntime } from "../lib/filters";
import { kindOf, KIND_LABELS } from "../lib/media";
import { posterUrl, titleLinks } from "../lib/tmdb";
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
              {[kindOf(pick) !== "movie" && KIND_LABELS[kindOf(pick)], pick.year, pick.rating != null && `★ ${pick.rating.toFixed(1)}`, formatRuntime(pick.runtime) && formatRuntime(pick.runtime) + (pick.media_type === "tv" ? "/ep" : ""), [...pick.genres, ...pick.tags].join(", ")].filter(Boolean).join(" · ")}
            </div>
            {pick.overview && <p className="pick-overview">{pick.overview}</p>}
            {titleLinks(pick)[0] && <a className="ticket-link" href={titleLinks(pick)[0].url} target="_blank" rel="noreferrer">Open on {titleLinks(pick)[0].label}</a>}
          </>
        ) : (
          <>
            <div className="pick-title">Can't decide?</div>
            <div className="pick-meta">Set the filters below, then roll for a random title from your list.</div>
          </>
        )}
      </div>
      <div className="stub">
        <button className="btn" onClick={onRoll} disabled={!poolSize}>{pick ? "Pick another" : "Pick a title"}</button>
        {pick && <button className="btn alt" onClick={onWatched}>We watched it</button>}
        <div className="count">{poolSize} {poolSize === 1 ? "title matches" : "titles match"}</div>
      </div>
    </section>
  );
}
