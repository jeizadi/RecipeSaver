function joinSection(
  existing: string,
  heading: string,
  addition: string
): string {
  const a = existing.trim();
  const b = addition.trim();
  if (!b) return a;
  if (!a) return `${heading}\n${b}`;
  return `${a}\n\n${heading}\n${b}`;
}

/**
 * Append a child recipe’s ingredients/instructions under a titled section
 * (same shape as the DB merge endpoint).
 */
export function appendMergedRecipeBlocks(
  parentIngredients: string,
  parentInstructions: string,
  childTitle: string,
  childIngredients: string,
  childInstructions: string
): { ingredientsText: string; instructionsText: string } {
  const heading = `--- ${childTitle} (merged) ---`;
  return {
    ingredientsText: joinSection(
      parentIngredients,
      heading,
      childIngredients
    ),
    instructionsText: joinSection(
      parentInstructions,
      heading,
      childInstructions
    ),
  };
}
