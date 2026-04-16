export function parseBaseServings(servings: string | null | undefined): number | null {
  if (!servings) return null;
  const m = servings.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function parseQuantityToken(token: string): number | null {
  const t = token.trim();
  if (/^\d+\s+\d+\/\d+$/.test(t)) {
    const [whole, frac] = t.split(/\s+/);
    const [n, d] = frac.split("/").map(Number);
    if (!d) return null;
    return Number(whole) + n / d;
  }
  if (/^\d+\/\d+$/.test(t)) {
    const [n, d] = t.split("/").map(Number);
    if (!d) return null;
    return n / d;
  }
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value - Math.round(value)) < 0.01) return String(Math.round(value));
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function scaleIngredientLine(line: string, factor: number): string {
  const re =
    /^(\s*(?:[-*•]\s*)?)(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)(\s*-\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+))?(\b.*)$/;
  const m = line.match(re);
  if (!m) return line;
  const leading = m[1] ?? "";
  const first = m[2] ?? "";
  const rangeSep = m[3] ?? "";
  const second = m[4] ?? "";
  const rest = m[5] ?? "";
  const a = parseQuantityToken(first);
  if (a == null) return line;
  const scaledA = formatQuantity(a * factor);
  if (!rangeSep || !second) return `${leading}${scaledA}${rest}`;
  const b = parseQuantityToken(second);
  if (b == null) return `${leading}${scaledA}${rest}`;
  const scaledB = formatQuantity(b * factor);
  return `${leading}${scaledA} - ${scaledB}${rest}`;
}

export function scaleIngredientsText(text: string, factor: number): string {
  if (factor === 1) return text;
  return text
    .split(/\r?\n/)
    .map((line) => scaleIngredientLine(line, factor))
    .join("\n");
}
