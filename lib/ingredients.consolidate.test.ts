import { describe, expect, it } from "vitest";
import {
  consolidateIngredients,
  formatAggregatedForClipboard,
  ingredientFingerprint,
  parseIngredientLine,
} from "./ingredients";

describe("ingredientFingerprint", () => {
  it("matches hyphen and space variants of olive oil", () => {
    const a = parseIngredientLine("1 tbsp extra virgin olive oil")!;
    const b = parseIngredientLine("1 tbsp extra-virgin olive oil")!;
    expect(ingredientFingerprint(a)).toBe(ingredientFingerprint(b));
    expect(ingredientFingerprint(a)).toBe("oilolive");
  });
});

describe("parseIngredientLine", () => {
  it("rewrites half an onion to fraction form", () => {
    const p = parseIngredientLine("half an onion");
    expect(p?.quantity).toBe(0.5);
    expect(p?.name.toLowerCase()).toContain("onion");
  });

  it("does not rewrite half and half", () => {
    const p = parseIngredientLine("half and half");
    expect(p?.quantity).toBeNull();
    expect(p?.name.toLowerCase()).toContain("half and half");
  });

  it("skips pinch-only lines", () => {
    const p = parseIngredientLine("pinch salt + pepper");
    expect(p).toBeNull();
  });
});

describe("consolidateIngredients", () => {
  it("merges two halves of onion", () => {
    const items = consolidateIngredients([
      { ingredientsText: "1/2 onion\n1/2 onion" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].totalQuantity).toBe(1);
  });

  it("merges half an onion with 1/2 onion", () => {
    const items = consolidateIngredients([
      { ingredientsText: "half an onion\n1/2 onion" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].totalQuantity).toBe(1);
  });

  it("merges head of lettuce with bare lettuce count", () => {
    const items = consolidateIngredients([
      { ingredientsText: "1 head of lettuce\n1 lettuce" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].totalQuantity).toBe(2);
    expect(items[0].unit).toBe("head");
  });

  it("merges garlic cloves phrasing", () => {
    const items = consolidateIngredients([
      { ingredientsText: "3 cloves garlic\n2 garlic cloves" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].totalQuantity).toBe(5);
    expect(items[0].unit).toBe("clove");
  });

  it("merges duplicate bunch lines", () => {
    const items = consolidateIngredients([
      { ingredientsText: "1 bunch cilantro\n1 bunch cilantro" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].totalQuantity).toBe(2);
    expect(items[0].unit).toBe("bunch");
  });

  it("merges canned black beans with different parenthetical sizes", () => {
    const items = consolidateIngredients([
      {
        ingredientsText:
          "2 (14-ounce) cans black beans\n1 can (15 ounces) black beans",
      },
    ]);
    const beans = items.find((i) => i.nameKey === "beansblack");
    expect(beans).toBeDefined();
    expect(beans!.unit).toBe("can");
    expect(beans!.totalQuantity).toBe(3);
  });

  it("merges Greek yogurt lines that fingerprint the same", () => {
    const items = consolidateIngredients([
      {
        ingredientsText:
          "1/2 cup (113g) plain greek yogurt\n1/2 cup (120g) plain greek yogurt",
      },
    ]);
    const y = items.find((i) => i.nameKey === "greekplainyogurt");
    expect(y).toBeDefined();
    expect(y!.unit).toBe("cup");
    expect(y!.totalQuantity).toBe(1);
  });

  it("merges apple cider vinegar lines", () => {
    const items = consolidateIngredients([
      {
        ingredientsText:
          "1 tsp apple cider vinegar\n1 tsp apple cider vinegar or distilled white vinegar",
      },
    ]);
    expect(
      items.filter((i) => i.nameKey === "applecidervinegar")
    ).toHaveLength(1);
    expect(
      items.find((i) => i.nameKey === "applecidervinegar")!.totalQuantity
    ).toBeCloseTo(2 / 48, 7);
  });

  it("merges olive oil across tbsp and cup with different wording", () => {
    const items = consolidateIngredients([
      {
        ingredientsText:
          "1 tbsp extra virgin olive oil\n3/8 cup extra-virgin olive oil (or sub melted butter)",
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].nameKey).toBe("oilolive");
    expect(items[0].unit).toBe("cup");
    expect(items[0].totalQuantity).toBeCloseTo(3 / 8 + 1 / 16, 10);
    const text = formatAggregatedForClipboard(items);
    expect(text.toLowerCase()).toContain("olive oil");
  });

  it("merges ground cinnamon with cinnamon", () => {
    const items = consolidateIngredients([
      {
        ingredientsText:
          "1/4 tsp ground cinnamon\n1 tsp cinnamon",
      },
    ]);
    const c = items.find((i) => i.nameKey === "cinnamon");
    expect(c).toBeDefined();
    expect(c!.unit).toBe("cup");
    expect(c!.totalQuantity).toBeCloseTo(1.25 / 48, 10);
    const text = formatAggregatedForClipboard([c!]);
    expect(text).toMatch(/1 1\/4/);
    expect(text.toLowerCase()).toContain("cinnamon");
  });

  it("merges all-purpose and whole wheat flour variants", () => {
    const items = consolidateIngredients([
      {
        ingredientsText:
          "1 cup all-purpose flour or whole wheat flour\n3 tbsp flour (whole wheat flour",
      },
    ]);
    const flour = items.find((i) => i.nameKey === "flour");
    expect(flour).toBeDefined();
    expect(flour!.unit).toBe("cup");
    expect(flour!.totalQuantity).toBeCloseTo(1 + 3 / 16, 10);
  });

  it("merges sea salt with salt", () => {
    const items = consolidateIngredients([
      {
        ingredientsText: "2 tsp salt\n3/4 tsp sea salt (plus more to taste)",
      },
    ]);
    const salt = items.find((i) => i.nameKey === "salt");
    expect(salt).toBeDefined();
    expect(salt!.unit).toBe("cup");
    expect(salt!.totalQuantity).toBeCloseTo(2.75 / 48, 10);
  });
});

describe("formatAggregatedForClipboard", () => {
  it("uses plural heads when quantity is greater than 1", () => {
    const text = formatAggregatedForClipboard(
      consolidateIngredients([
        { ingredientsText: "1 lettuce\n1 head of lettuce" },
      ])
    );
    expect(text.toLowerCase()).toContain("heads");
    expect(text.toLowerCase()).toContain("lettuce");
  });

  it("promotes large teaspoon totals to cups", () => {
    const text = formatAggregatedForClipboard(
      consolidateIngredients([
        { ingredientsText: "16 tsp pure maple syrup" },
      ])
    );
    expect(text.toLowerCase()).toContain("1/3 cup");
    expect(text.toLowerCase()).toContain("maple syrup");
  });

  it("rounds hard cup fractions to nearest eighth for readability", () => {
    const text = formatAggregatedForClipboard(
      consolidateIngredients([
        { ingredientsText: "11/16 cup olive oil" },
      ])
    );
    expect(text.toLowerCase()).toContain("1/2 cup + 3 tbsp");
    expect(text.toLowerCase()).toContain("olive oil");
  });

  it("promotes tiny cup totals to tablespoons when exact", () => {
    const text = formatAggregatedForClipboard(
      consolidateIngredients([
        { ingredientsText: "1/16 cup Worcestershire sauce" },
      ])
    );
    expect(text.toLowerCase()).toContain("1 tbsp");
    expect(text.toLowerCase()).toContain("worcestershire sauce");
  });

  it("uses mixed kitchen units for awkward larger volumes", () => {
    const text = formatAggregatedForClipboard(
      consolidateIngredients([
        { ingredientsText: "73 tsp honey" },
      ])
    );
    expect(text.toLowerCase()).toContain("1 cup + 1/2 cup + 1 tsp");
    expect(text.toLowerCase()).toContain("honey");
  });
});
