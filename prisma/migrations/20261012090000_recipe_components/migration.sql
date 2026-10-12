CREATE TABLE "recipe_components" (
    "id" SERIAL NOT NULL,
    "parent_recipe_id" INTEGER NOT NULL,
    "child_recipe_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "included_by_default" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recipe_components_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_components_parent_recipe_id_child_recipe_id_key" ON "recipe_components"("parent_recipe_id", "child_recipe_id");
CREATE INDEX "recipe_components_parent_recipe_id_sort_order_idx" ON "recipe_components"("parent_recipe_id", "sort_order");
CREATE INDEX "recipe_components_child_recipe_id_idx" ON "recipe_components"("child_recipe_id");
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_parent_recipe_id_fkey" FOREIGN KEY ("parent_recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_child_recipe_id_fkey" FOREIGN KEY ("child_recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
