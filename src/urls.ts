/**
 * URL helpers for sites that live on several domains (mirrors) and move between them.
 *
 * Store paths, not absolute URLs, wherever a bridge controls the id: `/manga/abc` survives a domain
 * move, `https://old-domain.com/manga/abc` doesn't. When a site only ever hands out absolute URLs,
 * {@link pathOf} strips them down and {@link rebase} puts them back on the current mirror.
 */

/** Lowercased host of an absolute URL, without a leading `www.`; undefined if it isn't one. */
export function siteHost(url: string): string | undefined {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:@]+@)?([^/?#:]+)/i.exec(url);
  return m ? m[2]!.toLowerCase().replace(/^www\./, "") : undefined;
}

/** Whether `host` is `domain` or a subdomain of it. Leading `www.` is ignored on both. */
export function hostCovers(domain: string, host: string): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "");
  const h = host.toLowerCase().replace(/^www\./, "");
  return h === d || h.endsWith(`.${d}`);
}

/** Path + query + fragment of an absolute URL (`/manga/abc?x=1`), or the input unchanged if relative. */
export function pathOf(url: string): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(.*)$/i.exec(url);
  if (!m) return url;
  return m[1] || "/";
}

/** `url`'s path on `base` (`https://mirror.tld`): moves an absolute URL to another mirror, or resolves a path. */
export function rebase(url: string, base: string): string {
  const path = pathOf(url);
  return base.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`);
}

/** Whether `url` is on any of `hosts` (domains or mirrors, subdomains included). */
export function onHosts(url: string, hosts: readonly string[]): boolean {
  const h = siteHost(url);
  return h !== undefined && hosts.some((d) => hostCovers(d, h));
}

/**
 * The base URL to use given the site's `mirrors` (first is the default) and a user's choice — a
 * setting holding either one of the mirrors or a custom `https://…` origin for a domain the bridge
 * doesn't know yet. Anything else falls back to the default.
 */
export function pickMirror(mirrors: readonly string[], chosen?: string | null): string {
  const fallback = mirrors[0];
  if (fallback === undefined) throw new Error("pickMirror: no mirrors given");
  const c = chosen?.trim().replace(/\/+$/, "");
  if (!c) return fallback;
  const known = mirrors.find((m) => m.replace(/\/+$/, "") === c);
  if (known) return known;
  return /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(c) ? c : fallback;
}
