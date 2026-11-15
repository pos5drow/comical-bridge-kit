/**
 * Response guards: recognise a response that is not the page the bridge asked for — an anti-bot
 * challenge, a block, a site that moved — before the bridge tries to parse it as content.
 *
 * A guard knows web infrastructure (Cloudflare, DDoS-Guard, redirects), never a particular site, and
 * answers with a plain {@link Verdict}. Turning a verdict into the host's error vocabulary is the
 * consuming repo's job (one small adapter), which keeps this package free of any runtime dependency.
 */
import { hostCovers, siteHost } from "./urls.ts";

/** The parts of an HTTP response a guard looks at. Structurally compatible with Comical's `HttpResponse`. */
export interface ResponseLike {
  /** The final URL, after redirects. */
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Why a response isn't content. */
export type Verdict =
  /** An interactive anti-bot check. Asking again soon only prolongs it, so back off for `retryMs`. */
  | { kind: "challenge"; vendor: string; retryMs: number; reason: string }
  /** A flat refusal (an IP or region block, a ban page). Waiting may or may not help. */
  | { kind: "blocked"; vendor: string; retryMs: number; reason: string }
  /** The request was redirected off the site's known hosts: a domain move, or a parked domain. */
  | { kind: "moved"; from: string; to: string; reason: string };

/** Inspects a response; returns a verdict when it isn't content, otherwise undefined. */
export type Guard = (res: ResponseLike) => Verdict | undefined;

/** How long to back off from an anti-bot challenge by default. They hold a flagged client for minutes. */
export const DEFAULT_CHALLENGE_WAIT_MS = 5 * 60 * 1000;

/** Case-insensitive header lookup (hosts differ in how they case header names). */
export function header(headers: Record<string, string>, name: string): string | undefined {
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === want) return v;
  return undefined;
}

/** Only sniff the start of a body: challenge pages are small and say what they are up front. */
function head(body: string, n = 4096): string {
  return body.length > n ? body.slice(0, n) : body;
}

/**
 * Cloudflare's managed challenge / JS challenge / Turnstile interstitial. The authoritative signal is
 * the `cf-mitigated: challenge` header; older and some proxied deployments only show the
 * interstitial markup on a 403/503 from `server: cloudflare`.
 */
export function cloudflare(opts: { retryMs?: number } = {}): Guard {
  const retryMs = opts.retryMs ?? DEFAULT_CHALLENGE_WAIT_MS;
  return (res) => {
    const mitigated = header(res.headers, "cf-mitigated");
    if (mitigated && /challenge/i.test(mitigated)) {
      return { kind: "challenge", vendor: "cloudflare", retryMs, reason: "challenged by Cloudflare" };
    }
    if (res.status !== 403 && res.status !== 503) return undefined;
    const server = header(res.headers, "server") ?? "";
    const html = head(res.body);
    const markup =
      /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html) ||
      /challenge-platform|cf-chl-|cf_chl_opt|cf-turnstile/i.test(html);
    if (markup && (/cloudflare/i.test(server) || /cloudflare/i.test(html))) {
      return { kind: "challenge", vendor: "cloudflare", retryMs, reason: "challenged by Cloudflare" };
    }
    // Cloudflare's own block page ("Sorry, you have been blocked", error 1020 and friends).
    if (/cloudflare/i.test(server) && /Sorry, you have been blocked|error code:?\s*10\d\d/i.test(html)) {
      return { kind: "blocked", vendor: "cloudflare", retryMs, reason: "blocked by Cloudflare" };
    }
    return undefined;
  };
}

/** DDoS-Guard's check page, used by a number of manga sites in place of Cloudflare. */
export function ddosGuard(opts: { retryMs?: number } = {}): Guard {
  const retryMs = opts.retryMs ?? DEFAULT_CHALLENGE_WAIT_MS;
  return (res) => {
    if (res.status !== 403 && res.status !== 503) return undefined;
    const server = header(res.headers, "server") ?? "";
    if (!/ddos-guard/i.test(server) && !/ddos-guard/i.test(head(res.body))) return undefined;
    return { kind: "challenge", vendor: "ddos-guard", retryMs, reason: "challenged by DDoS-Guard" };
  };
}

/**
 * The request ended up on a host the bridge doesn't know: the site moved domains (or the old domain
 * was parked). `hosts` are the site's domains and mirrors, plus any CDN it legitimately redirects to.
 * Pass it the full list — a redirect between two of the site's own mirrors is not a move.
 */
export function domainMoved(hosts: readonly string[]): Guard {
  return (res) => {
    const to = siteHost(res.url);
    if (!to || hosts.some((h) => hostCovers(h, to))) return undefined;
    return {
      kind: "moved",
      from: hosts[0] ?? "",
      to,
      reason: `redirected to ${to}, which isn't one of the site's known domains — it may have moved`,
    };
  };
}

/** Run `guards` in order; the first verdict wins. */
export function checkResponse(res: ResponseLike, guards: readonly Guard[]): Verdict | undefined {
  for (const g of guards) {
    const v = g(res);
    if (v) return v;
  }
  return undefined;
}

/** The guards nearly every scraped site wants: the common anti-bot vendors, plus a move check. */
export function standardGuards(hosts: readonly string[], opts: { retryMs?: number } = {}): Guard[] {
  return [cloudflare(opts), ddosGuard(opts), domainMoved(hosts)];
}
