import { describe, expect, test } from "bun:test";
import { chapterNumber, onHosts, parseStatus, pathOf, pickMirror, rebase, siteHost } from "../src/index.ts";

describe("chapterNumber", () => {
  test.each([
    ["Chapter 12", 12],
    ["Chapter 12.5", 12.5],
    ["Ch. 12 - 5 Years Later", 12],
    ["Vol.2 Ch.15", 15],
    ["Vol. 2 Chapter 15: The End", 15],
    ["Episode 3", 3],
    ["Capítulo 40", 40],
    ["Cap. 7", 7],
    ["#108", 108],
    ["108", 108],
    ["Vol. 3 - 22", 22],
    ["Season 2 Episode 5", 5],
  ])("%p", (label, want) => expect(chapterNumber(label)).toBe(want));

  test("no number", () => {
    expect(chapterNumber("Oneshot")).toBeUndefined();
    expect(chapterNumber("Prologue")).toBeUndefined();
  });
});

describe("parseStatus", () => {
  test.each([
    ["Ongoing", "ongoing"],
    ["OnGoing", "ongoing"],
    ["En emisión", "ongoing"],
    ["Publicándose", "ongoing"],
    ["Completed", "completed"],
    ["Finalizado", "completed"],
    ["On Hold", "hiatus"],
    ["Hiatus", "hiatus"],
    ["Dropped", "cancelled"],
    ["Cancelado", "cancelled"],
    ["Coming soon", "unknown"],
    ["", "unknown"],
  ] as const)("%p", (label, want) => expect(parseStatus(label)).toBe(want));
  test("missing label", () => expect(parseStatus(undefined)).toBe("unknown"));
});

describe("urls", () => {
  test("siteHost drops www. and ports", () => {
    expect(siteHost("https://www.Example.com:8080/a")).toBe("example.com");
    expect(siteHost("/relative")).toBeUndefined();
  });
  test("pathOf and rebase move a URL between mirrors", () => {
    expect(pathOf("https://old.tld/manga/abc?x=1#y")).toBe("/manga/abc?x=1#y");
    expect(pathOf("https://old.tld")).toBe("/");
    expect(pathOf("/already/path")).toBe("/already/path");
    expect(rebase("https://old.tld/manga/abc", "https://new.tld/")).toBe("https://new.tld/manga/abc");
    expect(rebase("manga/abc", "https://new.tld")).toBe("https://new.tld/manga/abc");
  });
  test("onHosts", () => {
    expect(onHosts("https://img.site.tld/1.jpg", ["site.tld"])).toBe(true);
    expect(onHosts("https://other.tld/1.jpg", ["site.tld"])).toBe(false);
  });
  test("pickMirror: a known mirror, a custom https origin, or the default", () => {
    const mirrors = ["https://a.tld", "https://b.tld"];
    expect(pickMirror(mirrors)).toBe("https://a.tld");
    expect(pickMirror(mirrors, "https://b.tld/")).toBe("https://b.tld");
    expect(pickMirror(mirrors, "https://new-domain.io")).toBe("https://new-domain.io");
    expect(pickMirror(mirrors, "http://insecure.tld")).toBe("https://a.tld");
    expect(pickMirror(mirrors, "javascript:alert(1)")).toBe("https://a.tld");
    expect(() => pickMirror([])).toThrow();
  });
});

describe("fold", () => {
  test("strips accents with or without String.prototype.normalize", async () => {
    const { fold } = await import("../src/text.ts");
    expect(fold("Capítulo Días AÑOS")).toBe("capitulo dias anos");
    const original = String.prototype.normalize;
    // Simulate an engine without normalize.
    (String.prototype as { normalize?: unknown }).normalize = undefined;
    try {
      expect(fold("Capítulo Días AÑOS")).toBe("capitulo dias anos");
    } finally {
      String.prototype.normalize = original;
    }
  });
});
