import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) { setState("error"); setMessage(error.message); }
    else setState("sent");
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
