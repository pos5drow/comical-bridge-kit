/**
 * comical-bridge-kit — site-agnostic scraping helpers for the pos5drow Comical bridge repos.
 *
 * Knows web infrastructure (anti-bot vendors, redirects, date formats), never a particular site, and
 * imports nothing from Comical: verdicts and values are plain data a repo-side adapter maps onto the
 * runtime's error vocabulary. Consumed as a commit-pinned git dependency, so a bridge bundle's bytes
 * only change when that pin is bumped on purpose.
 */
export * from "./guards.ts";
export * from "./urls.ts";
export * from "./dates.ts";
export * from "./chapters.ts";
export * from "./status.ts";
export * from "./text.ts";
