/**
 * Chapter numbers out of the labels sites give them: "Chapter 12.5", "Ch. 12 - Title", "Vol.2 Ch.15",
 * "Episode 3", "Capítulo 40", "Cap. 7", "#12", or just "12".
 */
import { fold } from "./text.ts";

/** Keywords that introduce a chapter number (lowercase, accents stripped). */
const CHAPTER_WORDS = "chapter|chap|ch|episode|ep|capitulo|cap|chapitre|kapitel|chuong|bolum|#";

const KEYWORD = new RegExp(`(?:^|[^a-z])(?:${CHAPTER_WORDS})\\.?\\s*#?\\s*(\\d+(?:[.,]\\d+)?)`, "i");
/** A volume prefix, skipped so "Vol. 2 15" reads 15, not 2. */
const VOLUME = /\b(?:vol(?:ume)?|v|tomo|tome|band)\.?\s*\d+(?:[.,]\d+)?/gi;

/**
 * The chapter number in `label`, or undefined when there isn't one. A number after a chapter keyword
 * wins; otherwise the first number that isn't a volume.
 */
export function chapterNumber(label: string): number | undefined {
  const t = fold(label);
  const kw = KEYWORD.exec(t);
  const raw = kw?.[1] ?? /(\d+(?:[.,]\d+)?)/.exec(t.replace(VOLUME, " "))?.[1];
  if (raw === undefined) return undefined;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}
