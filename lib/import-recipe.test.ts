import { afterEach, describe, expect, it, vi } from "vitest";
import { importRecipeFromUrl, RecipeImportError } from "./import-recipe";

afterEach(() => {
  vi.unstubAllGlobals();
});

const multiWprmHtml = `<!DOCTYPE html><html><body>
<div id="wprm-recipe-container-40493" class="wprm-recipe-container"><h2 class="wprm-recipe-name">Main Dish</h2>
<div class="wprm-recipe-ingredients-container"><ul class="wprm-recipe-ingredients">
<li class="wprm-recipe-ingredient"><span class="wprm-checkbox-container"></span><span class="wprm-recipe-ingredient-amount">1</span> <span class="wprm-recipe-ingredient-name">salt</span></li>
</ul></div>
<div class="wprm-recipe-instructions-container"><ul class="wprm-recipe-instructions">
<li class="wprm-recipe-instruction"><div class="wprm-recipe-instruction-text"><span>Toast.</span></div></li>
</ul></div></div>
<div id="wprm-recipe-container-40506" class="wprm-recipe-container"><h2 class="wprm-recipe-name">Avocado Crema</h2>
<div class="wprm-recipe-ingredients-container"><ul class="wprm-recipe-ingredients">
<li class="wprm-recipe-ingredient"><span class="wprm-checkbox-container"></span><span class="wprm-recipe-ingredient-amount">2</span> <span class="wprm-recipe-ingredient-name">avocados</span></li>
</ul></div>
<div class="wprm-recipe-instructions-container"><ul class="wprm-recipe-instructions">
<li class="wprm-recipe-instruction"><div class="wprm-recipe-instruction-text"><span>Blend until smooth.</span></div></li>
</ul></div></div>
</body></html>`;

describe("importRecipeFromUrl", () => {
  it("reads a specific WP Recipe Maker card when the URL includes its fragment", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        ({
          ok: true,
          text: async () => multiWprmHtml,
        }) as Response
    );

    const r = await importRecipeFromUrl(
      "https://example.com/lentil-tacos/#wprm-recipe-container-40506"
    );
    expect(r.title).toBe("Avocado Crema");
    expect(r.ingredientsText).toContain("avocados");
    expect(r.instructionsText).toContain("Blend until smooth");
  });

  it("throws when the WPRM fragment does not match any container", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        ({
          ok: true,
          text: async () => "<html><body></body></html>",
        }) as Response
    );

    await expect(
      importRecipeFromUrl(
        "https://example.com/p/#wprm-recipe-container-99999"
      )
    ).rejects.toBeInstanceOf(RecipeImportError);
  });

  it("uses JSON-LD when there is no WPRM fragment", async () => {
    const html = `<!DOCTYPE html><html><head>
      <script type="application/ld+json">{"@type":"Recipe","name":"From JSON","recipeIngredient":["1 cup water"]}</script>
    </head><body></body></html>`;
    vi.stubGlobal(
      "fetch",
      async () =>
        ({
          ok: true,
          text: async () => html,
        }) as Response
    );

    const r = await importRecipeFromUrl("https://example.com/plain-post/");
    expect(r.title).toBe("From JSON");
    expect(r.ingredientsText).toContain("water");
  });
});
