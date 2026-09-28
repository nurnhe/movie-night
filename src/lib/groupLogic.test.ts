import { describe, expect, it } from "vitest";
import { applyMemberChanges, newMoviesOnly, parseEmails } from "./groupLogic";

describe("parseEmails", () => {
  it("splits on commas, spaces and newlines, lowercases and dedupes", () => {
    expect(parseEmails(" A@Example.com, b@example.com\nb@example.com;c@example.com ")).toEqual({
      valid: ["a@example.com", "b@example.com", "c@example.com"],
      invalid: [],
    });
  });

  it("reports anything that isn't an email", () => {
    expect(parseEmails("a@example.com nope bob@")).toEqual({ valid: ["a@example.com"], invalid: ["nope", "bob@"] });
  });

  it("returns nothing for blank input", () => {
    expect(parseEmails("  ")).toEqual({ valid: [], invalid: [] });
  });
});

describe("applyMemberChanges", () => {
  it("keeps concurrent additions made by someone else", () => {
    // Someone else added d@ after this dialog opened; saving must not drop them.
    expect(applyMemberChanges(["a@x.io", "b@x.io", "d@x.io"], ["c@x.io"], ["b@x.io"])).toEqual(["a@x.io", "d@x.io", "c@x.io"]);
  });

  it("does not duplicate someone who is already a member", () => {
    expect(applyMemberChanges(["a@x.io"], ["a@x.io"], [])).toEqual(["a@x.io"]);
  });
});

describe("newMoviesOnly", () => {
  const m = (title: string, tmdb_id: number | null) => ({ title, tmdb_id });

  it("skips movies already in the group by TMDB id, or by title when there's no id", () => {
    const existing = [m("Past Lives", 666277), m("Home video", null)];
    const incoming = [m("Past Lives (2023)", 666277), m("home video ", null), m("Aftersun", 965150)];
    expect(newMoviesOnly(existing, incoming)).toEqual([m("Aftersun", 965150)]);
  });

  it("drops duplicates within the incoming list", () => {
    expect(newMoviesOnly([], [m("Heat", 949), m("Heat", 949)])).toEqual([m("Heat", 949)]);
  });
});
