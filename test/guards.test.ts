import { describe, expect, test } from "bun:test";
import { checkResponse, cloudflare, ddosGuard, domainMoved, header, standardGuards, type ResponseLike } from "../src/index.ts";

const res = (over: Partial<ResponseLike> = {}): ResponseLike => ({
  url: "https://site.example/manga/1",
  status: 200,
  headers: {},
  body: "<html><body>content</body></html>",
  ...over,
});

describe("cloudflare", () => {
  const g = cloudflare();
  test("cf-mitigated: challenge is a challenge, whatever the status", () => {
    expect(g(res({ status: 403, headers: { "CF-Mitigated": "challenge" } }))?.kind).toBe("challenge");
    expect(g(res({ status: 200, headers: { "cf-mitigated": "challenge" } }))?.kind).toBe("challenge");
  });
  test("the interstitial markup on a 403 from cloudflare is a challenge", () => {
    const v = g(res({ status: 403, headers: { server: "cloudflare" }, body: "<!DOCTYPE html><title>Just a moment...</title>" }));
    expect(v).toEqual({ kind: "challenge", vendor: "cloudflare", retryMs: 300000, reason: "challenged by Cloudflare" });
  });
  test("the block page is a block", () => {
    expect(g(res({ status: 403, headers: { server: "cloudflare" }, body: "Sorry, you have been blocked" }))?.kind).toBe("blocked");
  });
  test("an ordinary 403 or a 200 page is not Cloudflare's business", () => {
    expect(g(res({ status: 403, body: "Forbidden" }))).toBeUndefined();
    expect(g(res({ headers: { server: "cloudflare" } }))).toBeUndefined();
    // A real page that merely mentions the words, served OK.
    expect(g(res({ body: "<title>Just a moment...</title> a chapter title" }))).toBeUndefined();
  });
  test("retryMs is configurable", () => {
    expect(cloudflare({ retryMs: 1000 })(res({ headers: { "cf-mitigated": "challenge" } }))).toMatchObject({ retryMs: 1000 });
  });
});

describe("ddosGuard", () => {
  test("recognises its server header or page on 403/503 only", () => {
    expect(ddosGuard()(res({ status: 403, headers: { Server: "ddos-guard" } }))?.vendor).toBe("ddos-guard");
    expect(ddosGuard()(res({ status: 503, body: "<p>DDoS-Guard</p>" }))?.kind).toBe("challenge");
    expect(ddosGuard()(res({ status: 200, headers: { server: "ddos-guard" } }))).toBeUndefined();
  });
});

describe("domainMoved", () => {
  const g = domainMoved(["natomanga.com", "manganato.gg", "cdn.example"]);
  test("a mirror, a subdomain or www. is home", () => {
    expect(g(res({ url: "https://www.natomanga.com/x" }))).toBeUndefined();
    expect(g(res({ url: "https://manganato.gg/x" }))).toBeUndefined();
    expect(g(res({ url: "https://img.cdn.example/1.jpg" }))).toBeUndefined();
  });
  test("anywhere else is a move", () => {
    expect(g(res({ url: "https://www.newmanga.net/x" }))).toMatchObject({ kind: "moved", from: "natomanga.com", to: "newmanga.net" });
  });
  test("a lookalike suffix is not a subdomain", () => {
    expect(g(res({ url: "https://evilnatomanga.com/" }))?.kind).toBe("moved");
  });
});

describe("checkResponse", () => {
  test("first verdict wins; content passes", () => {
    const guards = standardGuards(["site.example"]);
    expect(checkResponse(res(), guards)).toBeUndefined();
    expect(checkResponse(res({ url: "https://parked.example/", headers: { "cf-mitigated": "challenge" } }), guards)?.kind).toBe("challenge");
    expect(checkResponse(res({ url: "https://parked.example/" }), guards)?.kind).toBe("moved");
  });
  test("header lookup ignores case", () => {
    expect(header({ "Content-Type": "x" }, "content-type")).toBe("x");
    expect(header({}, "x")).toBeUndefined();
  });
});
