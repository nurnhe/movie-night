// Installing the app to the home screen. Chrome, Edge and Samsung Internet on Android offer an
// install prompt the page can trigger; iPhones and iPads only allow it from the browser's Share menu.

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallMode = "installed" | "prompt" | "ios" | "none";

export function isIos(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  // iPadOS reports itself as a Mac, so tell it apart by touch support.
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

export function installMode(o: { standalone: boolean; hasPrompt: boolean; ios: boolean }): InstallMode {
  if (o.standalone) return "installed";
  if (o.hasPrompt) return "prompt";
  return o.ios ? "ios" : "none";
}

// The browser can fire beforeinstallprompt before React has rendered, so keep it from the start.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function listenForInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => { deferred = null; notify(); });
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const hasInstallPrompt = () => deferred != null;

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null; // each prompt can only be shown once
  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome === "accepted";
}

export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => { /* the app still works, just not offline */ });
  });
}
