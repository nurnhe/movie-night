import { useEffect, useState, type ReactNode } from "react";

/* Colour theme: Auto follows the device, or force Light or Dark. Saved under "nurnhe-theme", one key shared by
   all of KK's apps on nurnhe.github.io, so switching it in one app switches them all. */
type Theme = "auto" | "light" | "dark";
const KEY = "nurnhe-theme";

function read(): Theme {
  try { const t = localStorage.getItem(KEY); return t === "light" || t === "dark" ? t : "auto"; } catch { return "auto"; }
}
function apply(t: Theme) {
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

const OPTIONS: [Theme, string, ReactNode][] = [
  ["auto", "Match device", <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" /></>],
  ["light", "Light", <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>],
  ["dark", "Dark", <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />],
];

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(read);
  useEffect(() => { apply(theme); }, [theme]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setTheme(read()); };
    addEventListener("storage", onStorage);
    return () => removeEventListener("storage", onStorage);
  }, []);
  const choose = (t: Theme) => { try { localStorage.setItem(KEY, t); } catch { /* private mode */ } setTheme(t); };
  return (
    <div className="theme-switch" role="group" aria-label="Colour theme">
      {OPTIONS.map(([t, label, icon]) => (
        <button key={t} type="button" aria-pressed={theme === t} aria-label={label} title={label} onClick={() => choose(t)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>
        </button>
      ))}
    </div>
  );
}
