import { useState, type FormEvent } from "react";
import { sendSignInLinkToEmail } from "firebase/auth";
import { auth, SIGNIN_EMAIL_KEY } from "../lib/firebase";

export function SignIn({ initialError = "" }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(initialError ? "error" : "idle");
  const [message, setMessage] = useState(initialError);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const address = email.trim();
    try {
      await sendSignInLinkToEmail(auth, address, {
        url: window.location.origin + window.location.pathname,
        handleCodeInApp: true,
      });
      try { localStorage.setItem(SIGNIN_EMAIL_KEY, address); } catch { /* asked again when the link opens */ }
      setState("sent");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Couldn't send the sign-in link.");
    }
  }

  return (
    <main className="signin">
      <h1 className="brand">Movie Night <span>Queue</span></h1>
      <p className="lede">Your shared watchlist. Sign in with your email and we'll send you a link.</p>
      {state === "sent" ? (
        <p className="notice">Check <strong>{email}</strong> for a sign-in link. You can close this tab once you've clicked it.</p>
      ) : (
        <form onSubmit={submit} className="signin-form">
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn primary" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send sign-in link"}</button>
          {state === "error" && <p className="error">{message}</p>}
        </form>
      )}
    </main>
  );
}
