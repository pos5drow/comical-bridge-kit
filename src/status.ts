/**
 * Publication status words, in English and Spanish, mapped onto the five values reader apps use.
 * The union matches Comical's `SeriesStatus` literally, so a result can be assigned straight to it.
 */
import { fold } from "./text.ts";
export type PublicationStatus = "unknown" | "ongoing" | "completed" | "hiatus" | "cancelled";

const WORDS: ReadonlyArray<[RegExp, PublicationStatus]> = [
  [/\b(hiatus|on hold|paused|pausad[oa]|en pausa|en hiatus|hiato)\b/, "hiatus"],
  [/\b(cancell?ed|discontinued|dropped|abandoned|cancelad[oa]|abandonad[oa]|descontinuad[oa])\b/, "cancelled"],
  [/\b(completed?|complete|finished|ended|end|finalizad[oa]|terminad[oa]|completad[oa]|concluid[oa])\b/, "completed"],
  [/\b(ongoing|on ?going|publishing|releasing|airing|updating|serializ(?:ing|ation)|en curso|en emision|publicandose|active|activ[oa]|en publicacion)\b/, "ongoing"],
];

/** The status a site's label names ("Ongoing", "Completed", "En emisión", "Finalizado", …). */
export function parseStatus(label: string | undefined | null): PublicationStatus {
  if (!label) return "unknown";
  const t = fold(label);
  for (const [re, status] of WORDS) if (re.test(t)) return status;
  return "unknown";
}
