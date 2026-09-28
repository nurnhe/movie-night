import { MAX_STARS } from "../lib/ratings";

interface Props {
  value: number | null;
  onChange: (stars: number | null) => void;
  label: string;
}

export function StarRating({ value, onChange, label }: Props) {
  return (
    <span className="stars" role="group" aria-label={label}>
      {Array.from({ length: MAX_STARS }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" className={"star" + (value != null && n <= value ? " on" : "")}
          aria-pressed={value === n} aria-label={`${n} star${n === 1 ? "" : "s"}${value === n ? " (click to clear)" : ""}`}
          onClick={() => onChange(value === n ? null : n)}>
          ★
        </button>
      ))}
    </span>
  );
}
