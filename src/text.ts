/** Small text utilities shared by the parsers. */

const FALLBACK_FOLD: Record<string, string> = {
  á: "a", à: "a", â: "a", ä: "a", ã: "a", å: "a", é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i", ó: "o", ò: "o", ô: "o", ö: "o", õ: "o",
  ú: "u", ù: "u", û: "u", ü: "u", ñ: "n", ç: "c", ý: "y", ÿ: "y",
};

/**
 * Lowercase and strip accents ("Días" → "dias"). Uses Unicode normalisation where the engine has it;
 * some embedded engines ship without `String.prototype.normalize`, so a Latin table covers those.
 */
export function fold(text: string): string {
  const lower = text.toLowerCase();
  if (typeof lower.normalize === "function") {
    try {
      return lower.normalize("NFD").replace(/[̀-ͯ]/g, "");
    } catch {
      // fall through to the table
    }
  }
  return lower.replace(/[^\u0000-\u007f]/g, (c) => FALLBACK_FOLD[c] ?? c);
}
