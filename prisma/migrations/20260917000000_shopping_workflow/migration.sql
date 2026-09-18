CREATE TABLE "shopping_lists" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shopping_list_items" (
    "id" SERIAL NOT NULL,
    "shopping_list_id" INTEGER NOT NULL,
    "name_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'other',
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "source_recipe_ids" TEXT NOT NULL DEFAULT '',
    "source_labels" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shopping_staples" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "quantity" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'other',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_staples_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shopping_lists_user_id_week_start_key" ON "shopping_lists"("user_id", "week_start");
CREATE INDEX "shopping_lists_user_id_week_start_idx" ON "shopping_lists"("user_id", "week_start");
CREATE UNIQUE INDEX "shopping_list_items_shopping_list_id_name_key_key" ON "shopping_list_items"("shopping_list_id", "name_key");
CREATE INDEX "shopping_list_items_shopping_list_id_category_checked_idx" ON "shopping_list_items"("shopping_list_id", "category", "checked");
CREATE UNIQUE INDEX "shopping_staples_user_id_name_key_key" ON "shopping_staples"("user_id", "name_key");
CREATE INDEX "shopping_staples_user_id_active_idx" ON "shopping_staples"("user_id", "active");

ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shopping_list_id_fkey" FOREIGN KEY ("shopping_list_id") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopping_staples" ADD CONSTRAINT "shopping_staples_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
