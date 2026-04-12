import { describe, expect, it } from "vitest";
import {
  appendMergedRecipeBlocks,
  removeLastMergedRecipeBlocks,
  removeLastMergedRecipeSection,
} from "./merge-recipe-text";

describe("removeLastMergedRecipeSection", () => {
  it("round-trips a single merge after non-empty parent", () => {
    const parent = "1 cup flour";
    const child = { title: "Sauce", ing: "salt", inst: "mix" };
    const merged = appendMergedRecipeBlocks(
      parent,
      "step 1",
      child.title,
      child.ing,
      child.inst
    );
    const undone = removeLastMergedRecipeBlocks(
      merged.ingredientsText,
      merged.instructionsText,
      child.title
    );
    expect(undone.ingredientsText).toBe(parent);
    expect(undone.instructionsText).toBe("step 1");
  });

  it("removes the most recent block when the same title was merged twice", () => {
    let ing = "base";
    let inst = "do";
    for (const extra of ["first", "second"]) {
      const m = appendMergedRecipeBlocks(ing, inst, "Dup", extra, extra);
      ing = m.ingredientsText;
      inst = m.instructionsText;
    }
    const once = removeLastMergedRecipeSection(ing, "Dup");
    expect(once).toContain("--- Dup (merged) ---");
    expect(once).toContain("first");
    expect(once).not.toContain("second");
    const twice = removeLastMergedRecipeSection(once, "Dup");
    expect(twice).toBe("base");
  });

  it("handles merge as the only content", () => {
    const m = appendMergedRecipeBlocks("", "", "Only", "x", "y");
    const u = removeLastMergedRecipeBlocks(
      m.ingredientsText,
      m.instructionsText,
      "Only"
    );
    expect(u.ingredientsText).toBe("");
    expect(u.instructionsText).toBe("");
  });
});
