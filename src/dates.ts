/**
 * Dates as manga sites print them: "3 hours ago", "hace 2 días", "yesterday", "Nov 14, 2026",
 * "14 de noviembre de 2026", "2026-11-14".
 *
 * Hand-rolled on purpose: bridges run on JavaScriptCore and QuickJS as well as V8, and `Date.parse`
 * on anything but ISO 8601 is implementation-defined — "Nov 14, 2026" parses on V8 and can come back
 * NaN elsewhere. Everything here resolves to epoch milliseconds; absolute dates land on UTC midnight.
 */
import { fold } from "./text.ts";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type Unit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";

/** Unit words (lowercase, accents stripped) → unit. English and Spanish; add languages here. */
const UNIT_WORDS: Record<string, Unit> = {
  s: "second", sec: "second", secs: "second", second: "second", seconds: "second",
  segundo: "second", segundos: "second",
  m: "minute", min: "minute", mins: "minute", minute: "minute", minutes: "minute",
  minuto: "minute", minutos: "minute",
  h: "hour", hr: "hour", hrs: "hour", hour: "hour", hours: "hour", hora: "hour", horas: "hour",
  d: "day", day: "day", days: "day", dia: "day", dias: "day",
  w: "week", wk: "week", wks: "week", week: "week", weeks: "week", semana: "week", semanas: "week",
  mo: "month", mos: "month", month: "month", months: "month", mes: "month", meses: "month",
  y: "year", yr: "year", yrs: "year", year: "year", years: "year", ano: "year", anos: "year",
};

/** Words standing in for "1": "an hour ago", "hace un día". */
const ONE_WORDS = new Set(["a", "an", "one", "un", "una", "uno"]);

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, ene: 0, enero: 0,
  feb: 1, february: 1, febrero: 1,
  mar: 2, march: 2, marzo: 2,
  apr: 3, april: 3, abr: 3, abril: 3,
  may: 4, mayo: 4,
  jun: 5, june: 5, junio: 5,
  jul: 6, july: 6, julio: 6,
  aug: 7, august: 7, ago: 7, agosto: 7,
  sep: 8, sept: 8, september: 8, septiembre: 8, setiembre: 8,
  oct: 9, october: 9, octubre: 9,
  nov: 10, november: 10, noviembre: 10,
  dec: 11, december: 11, dic: 11, diciembre: 11,
};

/** Lowercase, strip accents (días → dias), collapse whitespace. */
function normalise(text: string): string {
  return fold(text).replace(/\s+/g, " ").trim();
}

function subtract(now: number, n: number, unit: Unit): number {
  switch (unit) {
    case "second": return now - n * SECOND;
    case "minute": return now - n * MINUTE;
    case "hour": return now - n * HOUR;
    case "day": return now - n * DAY;
    case "week": return now - n * 7 * DAY;
    case "month": {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() - n);
      return d.getTime();
    }
    case "year": {
      const d = new Date(now);
      d.setUTCFullYear(d.getUTCFullYear() - n);
      return d.getTime();
    }
  }
}

/**
 * A relative date ("5 mins ago", "an hour ago", "hace 3 días", "yesterday", "ayer", "just now"),
 * as epoch ms relative to `now`; undefined if `text` isn't one.
 */
export function parseRelativeDate(text: string, now: number = Date.now()): number | undefined {
  const t = normalise(text);
  if (!t) return undefined;
  if (/^(just now|now|moments? ago|a moment ago|justo ahora|ahora|recien|hace un momento)$/.test(t)) return now;
  if (/^(today|hoy)$/.test(t)) return now;
  if (/^(yesterday|ayer)$/.test(t)) return now - DAY;
  if (/^(anteayer|antier)$/.test(t)) return now - 2 * DAY;

  // "5 minutes ago" / "5m ago" / "hace 5 minutos" / "5 minutes" (some sites drop "ago").
  const m =
    /^(?:hace\s+)?(\d+|an?|one|un|una|uno)\s*([a-z]+)\.?(?:\s+ago)?$/.exec(t) ??
    /^(?:about|around|over|almost|casi|alrededor de)\s+(\d+|an?|one|un|una|uno)\s*([a-z]+)\.?(?:\s+ago)?$/.exec(t) ??
    /^hace\s+(?:about|casi|alrededor de)?\s*(\d+|un|una|uno)\s*([a-z]+)$/.exec(t);
  if (!m) return undefined;
  const unit = UNIT_WORDS[m[2]!];
  if (!unit) return undefined;
  // Bare "5 minutes" without "ago"/"hace" is accepted only for full unit words, not "5m" (a size? a count?).
  if (!/\bago$|^hace\b/.test(t) && m[2]!.length < 3) return undefined;
  const n = ONE_WORDS.has(m[1]!) ? 1 : Number(m[1]);
  return Number.isFinite(n) ? subtract(now, n, unit) : undefined;
}

function utc(year: number, month: number, day: number): number | undefined {
  if (month < 0 || month > 11 || day < 1 || day > 31 || year < 1900 || year > 2200) return undefined;
  const ms = Date.UTC(year, month, day);
  // Reject roll-over (Feb 31 → Mar 3).
  return new Date(ms).getUTCDate() === day ? ms : undefined;
}

/** How to read an all-numeric date like 03/04/2026. ISO (2026-04-03) is always understood. */
export type NumericOrder = "mdy" | "dmy";

/**
 * An absolute date with a month name ("Nov 14, 2026", "November 14 2026", "14 Nov 2026",
 * "14 de noviembre de 2026") or numeric ("2026-11-14"; "11/14/2026" or "14/11/2026" given `order`),
 * as UTC-midnight epoch ms; undefined if `text` isn't one. A full ISO timestamp keeps its time.
 */
export function parseAbsoluteDate(text: string, opts: { order?: NumericOrder } = {}): number | undefined {
  const raw = text.trim();
  // Full ISO 8601 timestamp: the one format every engine parses identically.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : undefined;
  }
  const t = normalise(raw).replace(/,/g, " ").replace(/\s+/g, " ");

  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (m) return utc(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (m && opts.order) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return opts.order === "mdy" ? utc(Number(m[3]), a - 1, b) : utc(Number(m[3]), b - 1, a);
  }

  // Month name first: "nov 14 2026", "november 14th 2026".
  m = /^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)? (\d{4})$/.exec(t);
  if (m && MONTHS[m[1]!] !== undefined) return utc(Number(m[3]), MONTHS[m[1]!]!, Number(m[2]));

  // Day first: "14 nov 2026", "14 de noviembre de 2026", "14th november 2026".
  m = /^(\d{1,2})(?:st|nd|rd|th)? (?:de )?([a-z]+)\.? (?:de |del )?(\d{4})$/.exec(t);
  if (m && MONTHS[m[2]!] !== undefined) return utc(Number(m[3]), MONTHS[m[2]!]!, Number(m[1]));

  return undefined;
}

/** {@link parseRelativeDate}, then {@link parseAbsoluteDate}. */
export function parseDate(
  text: string,
  opts: { now?: number; order?: NumericOrder } = {},
): number | undefined {
  return parseRelativeDate(text, opts.now ?? Date.now()) ?? parseAbsoluteDate(text, opts);
}
