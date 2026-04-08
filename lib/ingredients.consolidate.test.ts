import { describe, expect, it } from "vitest";
import {
  consolidateIngredients,
  formatAggregatedForClipboard,
  parseIngredientLine,
} from "./ingredients";

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
    const beans = items.find((i) => i.nameKey === "black beans");
    expect(beans).toBeDefined();
    expect(beans!.unit).toBe("can");
    expect(beans!.totalQuantity).toBe(3);
  });

  it("merges Greek yogurt wording variants in cups", () => {
    const items = consolidateIngredients([
      {
        ingredientsText:
          "1/2 cup (113g) plain or vanilla greek yogurt\n1/2 cup (120g) plain Greek or regular yogurt",
      },
    ]);
    const y = items.find((i) => i.nameKey === "greek yogurt");
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
      items.filter((i) => i.nameKey === "apple cider vinegar")
    ).toHaveLength(1);
    expect(
      items.find((i) => i.nameKey === "apple cider vinegar")!.totalQuantity
    ).toBe(2);
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
});
