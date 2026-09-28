import { describe, expect, it } from "vitest";
import { applyMemberChanges, mergePeople, newMoviesOnly, personLabel } from "./groupLogic";

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

describe("mergePeople", () => {
  it("combines the member list with other known emails, keeping names and dropping duplicates", () => {
    const people = mergePeople(
      [{ email: "Sam@X.io", name: "Sam" }, { email: "kira@x.io", name: "" }],
      ["sam@x.io", "alex@x.io", null, "  ", "KIRA@x.io"],
    );
    expect(people).toEqual([
      { email: "alex@x.io", name: "" },
      { email: "kira@x.io", name: "" },
      { email: "sam@x.io", name: "Sam" },
    ]);
  });

  it("labels people by name when there is one", () => {
    expect(personLabel({ email: "sam@x.io", name: "Sam" })).toBe("Sam (sam@x.io)");
    expect(personLabel({ email: "alex@x.io", name: "" })).toBe("alex@x.io");
  });
});
