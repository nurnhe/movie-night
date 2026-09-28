import { useState, type FormEvent } from "react";
import { sendSignInLinkToEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth, SIGNIN_EMAIL_KEY } from "../lib/firebase";
import { authMessage } from "../lib/authErrors";

export function SignIn({ initialError = "" }: { initialError?: string }) {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">(initialError ? "error" : "idle");
  const [message, setMessage] = useState(initialError);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("busy");
    const address = email.trim();
    try {
      if (mode === "password") {
        await signInWithEmailAndPassword(auth, address, password);
        return;
      }
      await sendSignInLinkToEmail(auth, address, {
        url: window.location.origin + window.location.pathname,
        handleCodeInApp: true,
      });
      try { localStorage.setItem(SIGNIN_EMAIL_KEY, address); } catch { /* asked again when the link opens */ }
      setState("sent");
    } catch (err) {
      setState("error");
      setMessage(authMessage(err));
    }
  }

  function switchMode() {
    setMode(mode === "password" ? "link" : "password");
    setState("idle");
    setMessage("");
  }

  return (
    <main className="signin">
      <h1 className="brand">Movie Night <span>Queue</span></h1>
      <p className="lede">
        {mode === "password" ? "Your shared watchlist. Sign in with your email and password." : "We'll email you a link that signs you in, no password needed."}
      </p>
      {state === "sent" ? (
        <p className="notice">Check <strong>{email}</strong> for a sign-in link. You can close this tab once you've clicked it.</p>
      ) : (
        <form onSubmit={submit} className="signin-form">
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode === "password" && (
            <>
              <label htmlFor="password" className="label">Password</label>
              <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </>
          )}
          <button className="btn primary" disabled={state === "busy"}>
            {state === "busy" ? (mode === "password" ? "Signing in…" : "Sending…") : mode === "password" ? "Sign in" : "Send sign-in link"}
          </button>
          {state === "error" && <p className="error">{message}</p>}
        </form>
      )}
      <p className="muted small">
        <button type="button" className="linklike" onClick={switchMode}>
          {mode === "password" ? "Forgot your password? Email me a sign-in link instead" : "Sign in with a password instead"}
        </button>
      </p>
    </main>
  );
}
