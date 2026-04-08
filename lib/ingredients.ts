export type ParsedIngredient = {
  /** Numeric quantity if we could parse it (e.g. 1.5), otherwise null. */
  quantity: number | null;
  /** Unit as written/normalized (e.g. "cup", "tsp"), or null if none. */
  unit: string | null;
  /** Core ingredient name (e.g. "sugar"). */
  name: string;
  /** Free-form trailing comment, e.g. ", chopped". */
  comment?: string;
  /** Original, unmodified line. */
  original: string;
};

export type AggregatedIngredient = {
  /** Stable merge key from {@link ingredientFingerprint} (sorted letter-only tokens). */
  nameKey: string;
  /** Human-readable name to display. */
  displayName: string;
  /** Unit used for the aggregated total (may be null). */
  unit: string | null;
  /** Sum of quantities across lines that we could parse, else null. */
  totalQuantity: number | null;
  /** All original lines that contributed to this item. */
  lines: string[];
};

const FRACTION_MAP: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅐": "1/7",
  "⅑": "1/9",
  "⅒": "1/10",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

const UNIT_ALIASES: Record<string, string> = {
  cup: "cup",
  cups: "cup",
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  clove: "clove",
  cloves: "clove",
  head: "head",
  heads: "head",
  bunch: "bunch",
  bunches: "bunch",
  can: "can",
  cans: "can",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
};

export function normalizeUnicodeFractions(text: string): string {
  let result = text;
  for (const [from, to] of Object.entries(FRACTION_MAP)) {
    if (result.includes(from)) {
      result = result.replace(new RegExp(from, "g"), to);
    }
  }
  return result;
}

function parseSimpleFraction(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Ranges like "2-3" → use the lower bound.
  const rangeMatch = trimmed.match(/^(\d+(?:\s+\d+\/\d+)?|\d+\/\d+)\s*-\s*\d/);
  if (rangeMatch) {
    return parseSimpleFraction(rangeMatch[1]);
  }

  // Mixed number like "1 1/2"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const num = Number(mixedMatch[2]);
    const den = Number(mixedMatch[3]) || 1;
    if (!Number.isFinite(whole) || !Number.isFinite(num) || !Number.isFinite(den)) {
      return null;
    }
    return whole + num / den;
  }

  // Simple fraction like "1/2"
  const fracMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    const num = Number(fracMatch[1]);
    const den = Number(fracMatch[2]) || 1;
    if (!Number.isFinite(num) || !Number.isFinite(den)) {
      return null;
    }
    return num / den;
  }

  // Plain integer or float.
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return UNIT_ALIASES[key] ?? key;
}

/**
 * Strip parenthetical weights/sizes (blog-style) so lines group in shopping lists.
 * Leaves narrative parens like (I recommend…) — they rarely start with a bare measurement pattern.
 */
function stripMeasurementParentheticalsForShopping(text: string): string {
  let s = text;
  const patterns = [
    /\s*\(\s*\d+(?:\.\d+)?\s*g\s*\)/gi,
    /\s*\(\s*\d+(?:\.\d+)?\s*ml\s*\)/gi,
    /\s*\(\s*\d+(?:\.\d+)?\s*(?:oz|ounce|ounces)\s*\)/gi,
    /\s*\(\s*\d+\s*[-–]\s*ounce[^)]*\)/gi,
    /\s*\(\s*\d+(?:\.\d+)?\s*[-–]\s*\d+\s*(?:oz|ounce|ounces)[^)]*\)/gi,
  ];
  for (const re of patterns) {
    s = s.replace(re, "");
  }
  return s.replace(/\s+/g, " ").trim();
}

const FINGERPRINT_STOP_TOKENS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "low",
  "no",
  "not",
  "of",
  "off",
  "on",
  "or",
  "per",
  "so",
  "the",
  "to",
  "up",
  "via",
  "with",
]);

/** Dropped for grouping when at least one other token remains (e.g. ground cinnamon → cinnamon). */
const FINGERPRINT_DESCRIPTOR_TOKENS = new Set([
  "all",
  "chopped",
  "coarse",
  "crushed",
  "diced",
  "divided",
  "extra",
  "fine",
  "finely",
  "fresh",
  "freshly",
  "grated",
  "ground",
  "heaping",
  "large",
  "medium",
  "minced",
  "optional",
  "organic",
  "packed",
  "pastry",
  "purpose",
  "roughly",
  "sea",
  "shredded",
  "sifted",
  "sliced",
  "small",
  "softened",
  "virgin",
  "warm",
  "wheat",
  "whole",
  "kosher",
]);

/**
 * When "A or B" is written as alternatives, keep the leading phrase for grouping only if
 * it looks like a full item (e.g. "apple cider vinegar or white vinegar" → first segment).
 */
function primaryAlternativeForFingerprint(nameLower: string): string {
  const parts = nameLower.split(/\s+or\s+/i);
  if (parts.length < 2) return nameLower;
  const leadTokens = parts[0].trim().split(/\s+/).filter(Boolean);
  if (leadTokens.length >= 2) return parts[0].trim();
  return nameLower;
}

/**
 * Stable merge key: letters-only tokens, punctuation and dashes removed, so
 * "extra-virgin olive oil" and "extra virgin olive oil" both collapse the same way.
 * Tokens are sorted so word order does not split duplicates.
 */
export function ingredientFingerprint(ing: ParsedIngredient): string {
  let s = ing.name.toLowerCase();
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/\(.*/g, " ");
  s = primaryAlternativeForFingerprint(s);
  s = s.replace(/\b(extra[-\s]+large|extra large|xl)\b/g, " ");
  s = s.replace(/[^a-z]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";

  let tokens = s.split(" ").filter(Boolean);
  tokens = tokens.filter((t) => !FINGERPRINT_STOP_TOKENS.has(t));
  const withoutDesc = tokens.filter((t) => !FINGERPRINT_DESCRIPTOR_TOKENS.has(t));
  if (withoutDesc.length > 0) tokens = withoutDesc;
  if (tokens.length === 0) return "";

  tokens.sort();
  return tokens.join("");
}

/**
 * "half an onion" / "half a lime" → "1/2 …" so fractions merge with numeric halves.
 * Does not match "half and half".
 */
function rewriteLeadingHalfLine(line: string): string {
  const t = line.trim();
  if (/^half and half\b/i.test(t)) return line;
  const halfAn = t.match(/^half an?\s+(.+)$/i);
  if (halfAn) {
    return `1/2 ${halfAn[1]}`;
  }
  const halfA = t.match(/^half a\s+(.+)$/i);
  if (halfA) {
    return `1/2 ${halfA[1]}`;
  }
  return line;
}

/** Produce where a bare count ("1 lettuce") usually means heads (see {@link ingredientFingerprint}). */
function isHeadCountableProduce(nameFingerprint: string): boolean {
  return /(lettuce|cabbage|cauliflower|broccoli|romaine|iceberg|kale|bokchoy)/.test(
    nameFingerprint
  );
}

/**
 * Strip "of " after head/clove/bunch; normalize "garlic cloves" → garlic + unit clove.
 */
function normalizeParsedForConsolidation(
  ing: ParsedIngredient
): ParsedIngredient {
  const { quantity, unit } = ing;
  let name = ing.name;
  const pinchOf = name.match(/^(?:a\s+)?pinch(?:es)?\s+of\s+(.+)$/i);
  if (pinchOf && (unit == null || unit === "pinch")) {
    name = pinchOf[1].trim();
    return { ...ing, name, unit: "pinch", quantity: quantity ?? 1 };
  }
  if (unit === "head" || unit === "clove" || unit === "bunch") {
    name = name.replace(/^of\s+/i, "").trim();
  }
  const ln = name.toLowerCase();
  if (quantity != null && /^garlic\s+cloves?$/.test(ln)) {
    return { ...ing, name: "garlic", unit: "clove", quantity };
  }
  return { ...ing, name, unit };
}

/**
 * When quantity is missing, assume 1 for countable head/clove/bunch lines so merges sum sensibly.
 */
function contributionQuantity(
  ing: ParsedIngredient,
  nameKey: string,
  unitKey: string | null
): number | null {
  if (ing.quantity != null) return ing.quantity;
  if (unitKey === "head" && isHeadCountableProduce(nameKey)) return 1;
  if (unitKey === "clove") return 1;
  if (unitKey === "bunch") return 1;
  return null;
}

const VOLUME_MERGE_UNITS = new Set(["cup", "tbsp", "tsp", "pinch"]);

/** 1 pinch ≈ 1/16 tsp for shopping-list math (merges with measured tsp). */
const TSP_PER_PINCH = 1 / 16;

function isVolumeMergeUnit(unit: string | null): boolean {
  return unit != null && VOLUME_MERGE_UNITS.has(unit);
}

/** Convert kitchen volume to cups (US: 1 cup = 16 tbsp = 48 tsp). */
function quantityToCups(qty: number, unit: string): number {
  if (unit === "cup") return qty;
  if (unit === "tbsp") return qty / 16;
  if (unit === "tsp") return qty / 48;
  if (unit === "pinch") return (qty * TSP_PER_PINCH) / 48;
  return qty;
}

/**
 * cup / tbsp / tsp lines for the same ingredient merge into one total (in cups).
 */
function volumeMergedGroupKey(nameKey: string, unitKey: string | null): string | null {
  if (!isVolumeMergeUnit(unitKey)) return null;
  return `${nameKey}|__vol__`;
}

function canonicalUnitForGrouping(
  nameKey: string,
  unitKey: string | null
): string | null {
  if (unitKey) return unitKey;
  if (isHeadCountableProduce(nameKey)) return "head";
  return null;
}

/** Same shape as {@link appendMergedRecipeBlocks} headings in merge-recipe-text.ts */
const MERGED_SECTION_HEADING_RE = /^---\s*(.+?)\s*\(merged\)\s*---\s*$/i;

const TITLE_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "best",
  "easy",
  "fresh",
  "from",
  "for",
  "homemade",
  "how",
  "make",
  "my",
  "or",
  "our",
  "recipe",
  "simple",
  "the",
  "to",
  "with",
  "your",
]);

function significantTitleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !TITLE_STOPWORDS.has(t));
}

/**
 * True if this ingredient line is shorthand for a merged sub-recipe (same title
 * we append under `--- Title (merged) ---`), so the shopping list should use
 * the merged block’s ingredients instead.
 */
function lineReferencesMergedRecipeTitle(
  line: string,
  mergedTitles: string[]
): boolean {
  if (!mergedTitles.length) return false;
  const low = line.toLowerCase();
  for (const title of mergedTitles) {
    const tokens = significantTitleTokens(title);
    if (tokens.length === 0) continue;
    const hits = tokens.filter((t) => low.includes(t));
    if (tokens.length === 1) {
      if (hits.length === 1) return true;
      continue;
    }
    const need = Math.max(2, Math.ceil(tokens.length * 0.66));
    if (hits.length >= need) return true;
  }
  return false;
}

/**
 * For shopping lists: drop `--- … (merged) ---` lines, remove main-list lines
 * that name a merged sub-recipe, and concatenate merged sections’ ingredient
 * lines so quantities reflect the full merged recipe.
 */
export function expandMergedRecipeIngredientsText(text: string): string {
  if (!text.trim()) return text;
  const lines = text.split(/\r?\n/);
  const mainLines: string[] = [];
  let current: string[] = mainLines;
  const mergedBlocks: string[][] = [];
  const mergedTitles: string[] = [];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const m = trimmed.match(MERGED_SECTION_HEADING_RE);
    if (m) {
      mergedTitles.push(m[1].trim());
      const next: string[] = [];
      mergedBlocks.push(next);
      current = next;
      continue;
    }
    current.push(trimmed);
  }

  const filteredMain = mainLines.filter(
    (line) => !lineReferencesMergedRecipeTitle(line, mergedTitles)
  );
  const mergedFlat = mergedBlocks.flat();
  return [...filteredMain, ...mergedFlat].join("\n");
}

export function parseIngredientLine(line: string): ParsedIngredient | null {
  const original = line;
  let text = normalizeUnicodeFractions(line).trim();
  text = rewriteLeadingHalfLine(text);
  text = stripMeasurementParentheticalsForShopping(text);
  if (!text) return null;

  if (MERGED_SECTION_HEADING_RE.test(text)) {
    return null;
  }

  // Skip section headers and comments.
  const lower = text.toLowerCase();
  if (
    lower.startsWith("for the ") ||
    lower.startsWith("for ") ||
    lower.endsWith(":") ||
    lower.startsWith("#")
  ) {
    return null;
  }
  if (/^(dry|wet)\s+ingredients?\s*$/i.test(lower)) {
    return null;
  }
  if (/^(?:a\s+)?pinch(?:es)?\b/i.test(lower)) {
    return null;
  }

  // Extract comma-separated comment: \"onion, chopped\" → name \"onion\", comment \"chopped\".
  let comment: string | undefined;
  const commaIndex = text.indexOf(",");
  if (commaIndex !== -1) {
    comment = text
      .slice(commaIndex + 1)
      .trim()
      .replace(/^\b(and|or)\b\s+/i, "");
    text = text.slice(0, commaIndex).trim();
  }

  // Quantity + unit + name.
  // Examples:
  //   \"1 cup sugar\"
  //   \"1 1/2 cups flour\"
  //   \"2-3 tbsp olive oil\"
  //   \"3 eggs\"
  const qtyUnitMatch = text.match(
    /^(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+(?:\s*-\s*\d+(?:\s+\d+\/\d+)?|\s*-\s*\d+\/\d+)?)\s+([^\s]+)\s+(.+)$/
  );

  let quantity: number | null = null;
  let unit: string | null = null;
  let name: string;

  if (qtyUnitMatch) {
    const [, rawQty, rawUnit, rest] = qtyUnitMatch;
    quantity = parseSimpleFraction(rawQty);
    const normalizedUnit = normalizeUnit(rawUnit);
    // If the \"unit\" doesn't look like a unit (e.g. \"eggs\"), treat it as part of the name.
    if (normalizedUnit && UNIT_ALIASES[rawUnit.toLowerCase()] !== undefined) {
      unit = normalizedUnit;
      name = rest.trim();
    } else {
      unit = null;
      name = `${rawUnit} ${rest}`.trim();
    }
  } else {
    // Try quantity with no unit: \"3 eggs\"
    const qtyOnlyMatch = text.match(
      /^(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+(?:\s*-\s*\d+(?:\s+\d+\/\d+)?|\s*-\s*\d+\/\d+)?)\s+(.+)$/
    );
    if (qtyOnlyMatch) {
      const [, rawQty, rest] = qtyOnlyMatch;
      quantity = parseSimpleFraction(rawQty);
      unit = null;
      name = rest.trim();
    } else {
      quantity = null;
      unit = null;
      name = text;
    }
  }

  const nameKey = name.trim().toLowerCase();
  if (!nameKey) {
    return null;
  }
  if (unit === "pinch") {
    return null;
  }

  return {
    quantity,
    unit,
    name: name.trim(),
    comment,
    original: original.trim(),
  };
}

export function parseIngredientsText(text: string): ParsedIngredient[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const result: ParsedIngredient[] = [];
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const parsed = parseIngredientLine(trimmed);
    if (parsed) {
      result.push(parsed);
    }
  }
  return result;
}

export function consolidateIngredients(
  sources: { recipeId?: number; title?: string; ingredientsText: string }[]
): AggregatedIngredient[] {
  const byKey = new Map<string, AggregatedIngredient>();

  for (const source of sources) {
    const parsed = parseIngredientsText(
      expandMergedRecipeIngredientsText(source.ingredientsText)
    );
    for (const raw of parsed) {
      const ing = normalizeParsedForConsolidation(raw);
      const nameKey = ingredientFingerprint(ing);
      const normalizedDeclaredUnit = normalizeUnit(ing.unit ?? undefined);
      const unitKey = canonicalUnitForGrouping(nameKey, normalizedDeclaredUnit);
      const volKey = volumeMergedGroupKey(nameKey, unitKey);
      const groupKey = volKey ?? (unitKey ? `${nameKey}|${unitKey}` : nameKey);
      const contribVol =
        volKey && ing.quantity != null && unitKey
          ? quantityToCups(ing.quantity, unitKey)
          : null;
      const contrib =
        contribVol ??
        contributionQuantity(ing, nameKey, unitKey);

      const existing = byKey.get(groupKey);
      if (!existing) {
        byKey.set(groupKey, {
          nameKey,
          displayName: ing.name,
          unit: volKey ? "cup" : (unitKey ?? null),
          totalQuantity: contrib ?? null,
          lines: [raw.original],
        });
      } else {
        existing.lines.push(raw.original);
        if (contrib != null) {
          existing.totalQuantity =
            (existing.totalQuantity ?? 0) + contrib;
        }
        if (ing.name.length < existing.displayName.length) {
          existing.displayName = ing.name;
        }
      }
    }
  }

  const items = Array.from(byKey.values());
  items.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return items;
}

function formatQuantity(qty: number): string {
  if (!Number.isFinite(qty)) return "";
  // Try to keep simple fractions when possible (e.g. 1.5 -> \"1 1/2\").
  const rounded = Math.round(qty * 8) / 8; // eighths
  const whole = Math.floor(rounded);
  const frac = rounded - whole;
  const epsilon = 1e-6;

  const toFracString = (f: number): string | null => {
    const num = Math.round(f * 8);
    if (Math.abs(f * 8 - num) > epsilon) return null;
    const den = 8;
    const g = gcd(num, den);
    return `${num / g}/${den / g}`;
  };

  const fracStr = frac > epsilon ? toFracString(frac) : null;

  if (!fracStr) {
    return rounded.toString();
  }
  if (whole === 0) {
    return fracStr;
  }
  return `${whole} ${fracStr}`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function formatReducedRational(numerator: number, denominator: number): string {
  const g = gcd(numerator, denominator);
  const num = numerator / g;
  const den = denominator / g;
  const whole = Math.floor(num / den);
  const rem = num % den;
  if (rem === 0) return whole.toString();
  const frac = `${rem}/${den}`;
  if (whole === 0) return frac;
  return `${whole} ${frac}`;
}

/** Format a cup amount as an exact reduced fraction (up to 1/48 cup precision). */
function formatCupQuantityFromTsp(tsp: number): string | null {
  if (!Number.isFinite(tsp) || tsp <= 0) return null;
  const n = Math.round(tsp);
  if (Math.abs(tsp - n) > 1e-5) return null;
  return formatReducedRational(n, 48);
}

/** Round cup amount to nearest 1/8 cup for readability. */
function roundCupToEighthString(cups: number): string {
  const rounded = Math.round(cups * 8) / 8;
  return formatQuantity(rounded);
}

const CUP_PLURAL_EPS = 1e-6;

function cupUnitWord(cups: number): "cup" | "cups" {
  if (!Number.isFinite(cups)) return "cup";
  if (Math.abs(cups - 1) < CUP_PLURAL_EPS) return "cup";
  if (cups > 1) return "cups";
  return "cup";
}

/** Teaspoon amount as an exact reduced fraction in sixteenths (typical for pinches + 1/4 tsp). */
function formatTspQuantityExactSixteenths(tsp: number): string | null {
  if (!Number.isFinite(tsp) || tsp <= 0) return null;
  const n = Math.round(tsp * 16);
  if (Math.abs(tsp * 16 - n) > 1e-5) return null;
  if (n <= 0) return null;
  return formatReducedRational(n, 16);
}

/**
 * Display for totals stored in cups after cup/tbsp/tsp merging.
 * Prefers exact sixteenth-cup fractions; otherwise whole tablespoons or teaspoons.
 */
function formatMixedVolumeFromTsp(tspInt: number): string {
  let remaining = tspInt;
  const parts: string[] = [];

  const cupsWhole = Math.floor(remaining / 48);
  if (cupsWhole > 0) {
    parts.push(`${formatQuantity(cupsWhole)} ${cupUnitWord(cupsWhole)}`);
    remaining -= cupsWhole * 48;
  }

  // Prefer friendly fractional cups before tbsp for awkward amounts.
  if (remaining >= 24) {
    parts.push("1/2 cup");
    remaining -= 24;
  }
  while (remaining >= 12) {
    parts.push("1/4 cup");
    remaining -= 12;
  }

  const tbspWhole = Math.floor(remaining / 3);
  if (tbspWhole > 0) {
    parts.push(`${formatQuantity(tbspWhole)} tbsp`);
    remaining -= tbspWhole * 3;
  }
  if (remaining > 0) {
    parts.push(`${formatQuantity(remaining)} tsp`);
  }
  return parts.join(" + ");
}

function formatVolumeTotalForClipboard(cups: number): string {
  if (!Number.isFinite(cups)) return "";
  const tspEq = cups * 48;
  const tspInt = Math.round(tspEq);
  if (Math.abs(tspEq - tspInt) < 1e-5) {
    if (tspInt <= 0) return `${formatQuantity(cups)} ${cupUnitWord(cups)}`;

    // Prefer largest readable unit: cups for >= 12 tsp, then tbsp.
    if (tspInt >= 12) {
      const exactCupStr = formatCupQuantityFromTsp(tspInt);
      const reducedDenominator = 48 / gcd(tspInt, 48);
      if (reducedDenominator > 8) {
        const mixed = formatMixedVolumeFromTsp(tspInt);
        if (mixed) return mixed;
      }
      const cupStr =
        reducedDenominator <= 8
          ? exactCupStr
          : roundCupToEighthString(tspInt / 48);
      if (cupStr) {
        return `${cupStr} ${cupUnitWord(tspInt / 48)}`;
      }
    }
    if (tspInt % 3 === 0) {
      return `${formatQuantity(tspInt / 3)} tbsp`;
    }
  }

  // Keep small/fractional totals readable as tsp (e.g. 5/16 tsp from cinnamon + pinch).
  const tspStr = formatTspQuantityExactSixteenths(tspEq);
  if (tspStr) {
    return `${tspStr} tsp`;
  }

  return `${formatQuantity(cups)} ${cupUnitWord(cups)}`;
}

export function formatAggregatedForClipboard(items: AggregatedIngredient[]): string {
  if (!items.length) return "";
  const lines: string[] = [];
  for (const item of items) {
    const parts: string[] = [];
    if (item.totalQuantity != null) {
      if (item.unit === "cup") {
        const vol = formatVolumeTotalForClipboard(item.totalQuantity);
        if (vol) parts.push(vol);
      } else {
        parts.push(formatQuantity(item.totalQuantity));
      }
    }
    if (item.unit && item.unit !== "cup") {
      const u =
        item.totalQuantity != null && item.totalQuantity > 1
          ? item.unit === "head"
            ? "heads"
            : item.unit === "can"
              ? "cans"
              : item.unit
          : item.unit;
      parts.push(u);
    } else if (!item.totalQuantity && item.unit === "cup") {
      parts.push("cup");
    }
    parts.push(item.displayName);
    const line = parts.join(" ").trim();
    if (line) {
      lines.push(line);
    } else {
      // Fallback: join original lines if we couldn't build a nice summary.
      for (const l of item.lines) {
        if (l.trim()) {
          lines.push(l.trim());
        }
      }
    }
  }
  return lines.join("\n");
}

