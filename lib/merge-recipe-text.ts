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

function nextMergeBlockStart(text: string, fromIndex: number): number {
  const marker = "\n\n--- ";
  let i = text.indexOf(marker, fromIndex);
  while (i !== -1) {
    const close = text.indexOf(" (merged) ---\n", i + marker.length);
    if (close !== -1) return i;
    i = text.indexOf(marker, i + 1);
  }
  return -1;
}

/**
 * Removes the **last** appended merge block for `childTitle` (same heading as
 * {@link appendMergedRecipeBlocks}). If the same title was merged twice, call
 * twice to remove both.
 */
export function removeLastMergedRecipeSection(
  text: string,
  childTitle: string
): string {
  const mid = `\n\n--- ${childTitle} (merged) ---\n`;
  let blockStart = text.lastIndexOf(mid);
  let afterHeader: number;
  if (blockStart !== -1) {
    afterHeader = blockStart + mid.length;
  } else {
    const start = `--- ${childTitle} (merged) ---\n`;
    if (text.startsWith(start)) {
      blockStart = 0;
      afterHeader = start.length;
    } else if (text === `--- ${childTitle} (merged) ---`) {
      return "";
    } else {
      return text;
    }
  }

  const nextHdr = nextMergeBlockStart(text, afterHeader);
  const blockEnd = nextHdr === -1 ? text.length : nextHdr;

  return (text.slice(0, blockStart) + text.slice(blockEnd))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "");
}

export function removeLastMergedRecipeBlocks(
  ingredientsText: string,
  instructionsText: string,
  childTitle: string
): { ingredientsText: string; instructionsText: string } {
  return {
    ingredientsText: removeLastMergedRecipeSection(ingredientsText, childTitle),
    instructionsText: removeLastMergedRecipeSection(instructionsText, childTitle),
  };
}
