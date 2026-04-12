import { describe, expect, it } from "vitest";
import {
  extractSamePageWprmRecipeSiblings,
  extractSameSiteRecipeLinksFromIngredientSectionsHtml,
  normalizeUrlForMatch,
} from "./recipe-link-heuristics";

describe("normalizeUrlForMatch", () => {
  it("preserves wprm recipe container hash for same-page siblings", () => {
    expect(
      normalizeUrlForMatch(
        "https://rainbowplantlife.com/lentil-tacos/#wprm-recipe-container-40506"
      )
    ).toBe(
      "https://rainbowplantlife.com/lentil-tacos#wprm-recipe-container-40506"
    );
  });

  it("still strips hash for ordinary anchors", () => {
    expect(
      normalizeUrlForMatch("https://example.com/post/#comments")
    ).toBe("https://example.com/post");
  });
});

describe("extractSamePageWprmRecipeSiblings", () => {
  it("returns later WPRM cards with titles when multiple containers exist", () => {
    const html = `
      <div id="wprm-recipe-container-40493" class="wprm-recipe-container">
        <h2 class="wprm-recipe-name">Lentil Tacos</h2>
      </div>
      <div id="wprm-recipe-container-40506" class="wprm-recipe-container">
        <h2 class="wprm-recipe-name">Avocado Crema</h2>
      </div>
      <div id="wprm-recipe-container-40508" class="wprm-recipe-container">
        <h2 class="wprm-recipe-name">Spicy Cabbage Slaw</h2>
      </div>
    `;
    const rows = extractSamePageWprmRecipeSiblings(
      html,
      "https://rainbowplantlife.com/lentil-tacos/"
    );
    expect(rows).toEqual([
      {
        url: "https://rainbowplantlife.com/lentil-tacos#wprm-recipe-container-40506",
        title: "Avocado Crema",
      },
      {
        url: "https://rainbowplantlife.com/lentil-tacos#wprm-recipe-container-40508",
        title: "Spicy Cabbage Slaw",
      },
    ]);
  });

  it("returns nothing when only one WPRM container", () => {
    const html = `<div id="wprm-recipe-container-1" class="wprm-recipe-container"></div>`;
    expect(extractSamePageWprmRecipeSiblings(html, "https://example.com/r/")).toEqual(
      []
    );
  });
});

describe("extractSameSiteRecipeLinksFromIngredientSectionsHtml", () => {
  it("finds same-origin links inside wprm ingredient containers", () => {
    const html = `
      <div class="wprm-recipe-ingredients-container">
        <ul class="wprm-recipe-ingredients">
          <li class="wprm-recipe-ingredient">
            <a href="https://rainbowplantlife.com/other-recipe/">sauce</a>
          </li>
        </ul>
      </div>
    `;
    const found = extractSameSiteRecipeLinksFromIngredientSectionsHtml(
      html,
      "https://rainbowplantlife.com/lentil-tacos/"
    );
    expect(found).toContain("https://rainbowplantlife.com/other-recipe/");
  });
});
