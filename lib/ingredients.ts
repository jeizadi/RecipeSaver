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
  /** Normalized key for grouping (lowercased, trimmed). */
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

export function parseIngredientLine(line: string): ParsedIngredient | null {
  const original = line;
  let text = normalizeUnicodeFractions(line).trim();
  if (!text) return null;

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

function buildNameKey(ing: ParsedIngredient): string {
  // Normalize the ingredient name for grouping:
  // - lowercase
  // - drop parenthetical notes (e.g. "(divided)", "(optional)")
  // - remove size adjectives like "small/medium/large"
  // - collapse repeated whitespace
  let key = ing.name.toLowerCase();
  key = key.replace(/\([^)]*\)/g, " "); // remove (...) blocks
  key = key.replace(
    /\b(extra[-\s]+large|extra large|xl|small|medium|large)\b/g,
    " "
  );
  // Normalize some common synonyms so they group:
  // sea salt, kosher salt -> salt
  key = key.replace(/\b(?:sea|kosher)\s+salt\b/g, "salt");
  return key.trim().replace(/\s+/g, " ");
}

export function consolidateIngredients(
  sources: { recipeId?: number; title?: string; ingredientsText: string }[]
): AggregatedIngredient[] {
  const byKey = new Map<string, AggregatedIngredient>();

  for (const source of sources) {
    const parsed = parseIngredientsText(source.ingredientsText);
    for (const ing of parsed) {
      const nameKey = buildNameKey(ing);
      const unitKey = normalizeUnit(ing.unit ?? undefined);
      const groupKey = unitKey ? `${nameKey}|${unitKey}` : nameKey;

      const existing = byKey.get(groupKey);
      if (!existing) {
        byKey.set(groupKey, {
          nameKey,
          displayName: ing.name,
          unit: unitKey ?? null,
          totalQuantity: ing.quantity,
          lines: [ing.original],
        });
      } else {
        existing.lines.push(ing.original);
        if (ing.quantity != null) {
          existing.totalQuantity =
            (existing.totalQuantity ?? 0) + ing.quantity;
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

export function formatAggregatedForClipboard(items: AggregatedIngredient[]): string {
  if (!items.length) return "";
  const lines: string[] = [];
  for (const item of items) {
    const parts: string[] = [];
    if (item.totalQuantity != null) {
      parts.push(formatQuantity(item.totalQuantity));
    }
    if (item.unit) {
      parts.push(item.unit);
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

