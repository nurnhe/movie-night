import { useEffect, useState, useSyncExternalStore } from "react";
import { hasInstallPrompt, installMode, isIos, isStandalone, promptInstall, subscribeInstall } from "../lib/install";

const DISMISSED_KEY = "install-hint-dismissed";

function readDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
}

export function InstallApp() {
  const hasPrompt = useSyncExternalStore(subscribeInstall, hasInstallPrompt);
  const [standalone, setStandalone] = useState(isStandalone);
  const [showHelp, setShowHelp] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);
  const ios = isIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const update = () => setStandalone(isStandalone());
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const mode = installMode({ standalone, hasPrompt, ios });
  if (mode === "installed" || mode === "none" || dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* only hides it for this visit */ }
    setDismissed(true);
  };

  if (mode === "prompt") {
    return <button className="btn small" onClick={() => promptInstall()}>Install app</button>;
  }

  return (
    <>
      <button className="btn small" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>Install app</button>
      {showHelp && (
        <div className="notice install-help" role="status">
          <span>To add Movie Night to your home screen, tap <strong>Share</strong> <span aria-hidden="true">(the square with an arrow)</span>, then <strong>Add to Home Screen</strong>.</span>
          <button className="linklike small" onClick={dismiss}>Don't show again</button>
        </div>
      )}
    </>
  );
}
