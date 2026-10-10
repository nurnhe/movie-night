import { useState } from "react";
import { MAX_STARS } from "../lib/ratings";

interface Props {
  value: number | null;
  onChange: (stars: number | null) => void;
  label: string;
}

// Each star has two click zones, so the left half rates x.5 and the right half rates x. Clicking your current rating clears it.
export function StarRating({ value, onChange, label }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <span className="stars" role="group" aria-label={label} onMouseLeave={() => setHover(null)}>
      {Array.from({ length: MAX_STARS }, (_, i) => i + 1).map((n) => (
        <span key={n} className="star">
          <span className="star-bg" aria-hidden="true">★</span>
          <span className="star-fg" aria-hidden="true" style={{ width: `${Math.max(0, Math.min(1, shown - (n - 1))) * 100}%` }}>★</span>
          {[n - 0.5, n].map((v, half) => (
            <button key={v} type="button" className={"star-hit " + (half === 0 ? "left" : "right")}
              aria-pressed={value === v} aria-label={`${v} star${v === 1 ? "" : "s"}${value === v ? " (click to clear)" : ""}`}
              onMouseEnter={() => setHover(v)} onFocus={() => setHover(v)} onBlur={() => setHover(null)}
              onClick={() => { setHover(null); onChange(value === v ? null : v); }} />
          ))}
        </span>
      ))}
    </span>
  );
}
