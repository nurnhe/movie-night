import type { Filters } from "../lib/filters";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  genres: string[];
  people: string[];
}

const runtimes = [
  { v: "", label: "Any length" },
  { v: "90", label: "Up to 1h 30m" },
  { v: "120", label: "Up to 2h" },
  { v: "150", label: "Up to 2h 30m" },
];
const ratings = [
  { v: "", label: "Any rating" },
  { v: "6", label: "★ 6+" },
  { v: "7", label: "★ 7+" },
  { v: "8", label: "★ 8+" },
];

export function FiltersBar({ filters, onChange, genres, people }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const toggleGenre = (g: string) =>
    set({ genres: filters.genres.includes(g) ? filters.genres.filter((x) => x !== g) : [...filters.genres, g] });

  return (
    <section className="filters" aria-label="Filters">
      <div className="filter-row">
        <div className="field grow">
          <label htmlFor="f-search" className="label">Search</label>
          <input id="f-search" type="search" placeholder="Title or note" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="f-len" className="label">Length</label>
          <select id="f-len" value={filters.maxRuntime ?? ""} onChange={(e) => set({ maxRuntime: e.target.value ? +e.target.value : null })}>
            {runtimes.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-rating" className="label">Rating</label>
          <select id="f-rating" value={filters.minRating ?? ""} onChange={(e) => set({ minRating: e.target.value ? +e.target.value : null })}>
            {ratings.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </div>
        {people.length > 1 && (
          <div className="field">
            <label htmlFor="f-by" className="label">Added by</label>
            <select id="f-by" value={filters.addedBy} onChange={(e) => set({ addedBy: e.target.value })}>
              <option value="">Either of us</option>
              {people.map((p) => <option key={p} value={p}>{p.split("@")[0]}</option>)}
            </select>
          </div>
        )}
      </div>
      {genres.length > 0 && (
        <div className="field">
          <span className="label">Genre <span className="label-hint">matches any selected</span></span>
          <div className="chips">
            {genres.map((g) => (
              <button key={g} type="button" className="chip" aria-pressed={filters.genres.includes(g)} onClick={() => toggleGenre(g)}>{g}</button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
