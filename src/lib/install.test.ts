import { describe, expect, it } from "vitest";
import { installMode, isIos } from "./install";

describe("isIos", () => {
  it("spots iPhones", () => {
    expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "iPhone", 5)).toBe(true);
  });
  it("spots iPads that report themselves as Macs", () => {
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe(true);
  });
  it("leaves real Macs and Android alone", () => {
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0)).toBe(false);
    expect(isIos("Mozilla/5.0 (Linux; Android 15; Pixel 9)", "Linux armv8l", 5)).toBe(false);
  });
});

describe("installMode", () => {
  it("hides the button once installed", () => {
    expect(installMode({ standalone: true, hasPrompt: true, ios: true })).toBe("installed");
  });
  it("uses the browser's prompt when there is one", () => {
    expect(installMode({ standalone: false, hasPrompt: true, ios: false })).toBe("prompt");
  });
  it("falls back to Share menu instructions on iOS", () => {
    expect(installMode({ standalone: false, hasPrompt: false, ios: true })).toBe("ios");
  });
  it("offers nothing where installing isn't possible", () => {
    expect(installMode({ standalone: false, hasPrompt: false, ios: false })).toBe("none");
  });
});
