const messages: Record<string, string> = {
  "permission-denied": "You don't have permission to do that. If this list was shared with you, ask the owner to check you're still on it.",
  unauthenticated: "You've been signed out. Sign in again.",
  unavailable: "Couldn't reach the server. Check your connection and try again.",
  "resource-exhausted": "Too many changes at once. Wait a moment and try again.",
  "not-found": "That's already gone.",
  cancelled: "That was interrupted. Try again.",
  "deadline-exceeded": "That took too long. Try again.",
};

export function firestoreMessage(e: unknown): string {
  const code = typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
  if (messages[code]) return messages[code];
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}
