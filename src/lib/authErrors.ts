const messages: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match.",
  "auth/wrong-password": "That email and password don't match.",
  "auth/user-not-found": "That email and password don't match.",
  "auth/invalid-email": "That doesn't look like an email address.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes, or sign in with an email link instead.",
  "auth/user-disabled": "This account has been turned off.",
  "auth/admin-restricted-operation": "There's no account for this email. Ask the owner to add you.",
  "auth/network-request-failed": "Couldn't reach the server. Check your connection and try again.",
  "auth/invalid-action-code": "That link has expired or was already used. Send a new one.",
  "auth/expired-action-code": "That link has expired. Send a new one.",
};

export function authMessage(err: unknown): string {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  if (messages[code]) return messages[code];
  return err instanceof Error ? err.message : "Something went wrong. Try again.";
}
