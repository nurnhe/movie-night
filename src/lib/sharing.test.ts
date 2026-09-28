import { describe, expect, it } from "vitest";
import { normalizeMovie } from "./movies";
import { canChangeSharing, collectionFor, groupIdOf, mergeMovieLists, sharingLabel, storedFields } from "./sharing";

const groups = [{ id: "g1", name: "Me and Sam" }];

describe("sharing", () => {
  it("keeps everyone's movies in /movies and the rest in /restricted", () => {
    expect(collectionFor("all")).toBe("movies");
    expect(collectionFor("me")).toBe("restricted");
    expect(collectionFor("group:g1")).toBe("restricted");
    expect(groupIdOf("group:g1")).toBe("g1");
    expect(groupIdOf("me")).toBeNull();
  });

  it("labels who a movie is shared with", () => {
    expect(sharingLabel("all", groups)).toBeNull();
    expect(sharingLabel("me", groups)).toBe("Only you");
    expect(sharingLabel("group:g1", groups)).toBe("Me and Sam");
    expect(sharingLabel("group:gone", groups)).toBe("Only you (group removed)");
  });

  it("lets only the person who added a movie change who it's shared with", () => {
    expect(canChangeSharing({ shared_with: "all", owner: null, added_by: "Kira@x.io" }, "kira@x.io")).toBe(true);
    expect(canChangeSharing({ shared_with: "all", owner: null, added_by: "sam@x.io" }, "kira@x.io")).toBe(false);
    expect(canChangeSharing({ shared_with: "group:g1", owner: "sam@x.io", added_by: "sam@x.io" }, "kira@x.io")).toBe(false);
    expect(canChangeSharing({ shared_with: "me", owner: "kira@x.io", added_by: "kira@x.io" }, "kira@x.io")).toBe(true);
  });

  it("stores owner and group only for movies not shared with everyone, keeping ratings", () => {
    const m = normalizeMovie("m1", { title: "Heat", created_at: "2026-01-01", added_by: "kira@x.io", ratings: { "sam@x.io": 5 } }, "movies");
    const toGroup = storedFields(m, "group:g1", "kira@x.io");
    expect(toGroup).toMatchObject({ title: "Heat", owner: "kira@x.io", group_id: "g1", ratings: { "sam@x.io": 5 } });
    expect(toGroup).not.toHaveProperty("id");
    expect(toGroup).not.toHaveProperty("shared_with");
    const back = storedFields({ ...m, shared_with: "group:g1", owner: "kira@x.io" }, "all", "kira@x.io");
    expect(back).not.toHaveProperty("owner");
    expect(back).not.toHaveProperty("group_id");
    expect(back).toMatchObject({ title: "Heat", ratings: { "sam@x.io": 5 } });
  });

  it("merges lists without duplicates, newest first", () => {
    const a = normalizeMovie("a", { title: "A", created_at: "2026-01-01" }, "movies");
    const b = normalizeMovie("b", { title: "B", created_at: "2026-03-01", owner: "k@x.io", group_id: "g1" }, "restricted");
    const c = normalizeMovie("c", { title: "C", created_at: "2026-02-01", owner: "k@x.io", group_id: null }, "restricted");
    expect(mergeMovieLists([[a], [b, c], [b]]).map((m) => m.id)).toEqual(["b", "c", "a"]);
  });
});
