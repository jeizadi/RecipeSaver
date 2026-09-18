import { describe, expect, it } from "vitest";
import {
  categoryForIngredient,
  normalizeShoppingName,
  parseWeekStart,
  weekEndExclusive,
} from "./shopping-list";

describe("shopping list helpers", () => {
  it("normalizes equivalent item names to one key", () => {
    expect(normalizeShoppingName("Extra Virgin Olive Oil")).toBe("extraoilolivevirgin");
    expect(normalizeShoppingName("olive-oil, extra virgin")).toBe("extraoilolivevirgin");
  });

  it("places common items into store-friendly categories", () => {
    expect(categoryForIngredient("baby spinach")).toBe("produce");
    expect(categoryForIngredient("whole milk")).toBe("dairy & eggs");
    expect(categoryForIngredient("all-purpose flour")).toBe("pantry");
    expect(categoryForIngredient("paper towels")).toBe("household");
  });

  it("parses a Monday week and derives the exclusive end", () => {
    const start = parseWeekStart("2026-09-14");
    expect(start.toISOString()).toBe("2026-09-14T00:00:00.000Z");
    expect(weekEndExclusive(start).toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });
});
