import { TMDB_NOTICE } from "../lib/tmdb";

// TMDB's API terms require its logo (kept smaller than our own title) and this exact notice, shown prominently.
export function TmdbCredit() {
  return (
    <footer className="foot credit">
      <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" aria-label="The Movie Database (TMDB)">
        <img src={`${import.meta.env.BASE_URL}tmdb-logo.svg`} alt="TMDB" height={16} />
      </a>
      <p>{TMDB_NOTICE}</p>
      <p className="muted small">Details, ratings and images for movies, TV shows and anime come from TMDB.</p>
      <p className="muted small">Where to watch (Netflix and HBO Max in Serbia) is provided by <a href="https://www.justwatch.com" target="_blank" rel="noreferrer">JustWatch</a>.</p>
    </footer>
  );
}
