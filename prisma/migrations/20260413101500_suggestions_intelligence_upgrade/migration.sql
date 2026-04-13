-- CreateEnum
CREATE TYPE "SuggestionLane" AS ENUM ('repeat_favorite', 'trusted_similar', 'explore');

-- AlterTable
ALTER TABLE "user_profiles"
  ADD COLUMN "weekly_budget_cents" INTEGER,
  ADD COLUMN "budget_tolerance_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
  ADD COLUMN "trusted_source_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0.65;

ALTER TABLE "recipe_features"
  ADD COLUMN "estimated_cost_cents" INTEGER,
  ADD COLUMN "cost_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "suggestion_items"
  ADD COLUMN "lane" "SuggestionLane" NOT NULL DEFAULT 'explore',
  ADD COLUMN "budget_fit_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "similarity_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "explain_json" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "user_behavior_aggregates" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "recipe_frequency_json" TEXT NOT NULL DEFAULT '',
    "domain_affinity_json" TEXT NOT NULL DEFAULT '',
    "ingredient_affinity_json" TEXT NOT NULL DEFAULT '',
    "recent_cooked_recipe_ids" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_behavior_aggregates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_preference_vectors" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "vector_version" INTEGER NOT NULL DEFAULT 1,
    "local_vector_json" TEXT NOT NULL DEFAULT '',
    "embedding_model" TEXT NOT NULL DEFAULT '',
    "embedding_vector" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_preference_vectors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_vector_snapshots" (
    "id" SERIAL NOT NULL,
    "recipe_feature_id" INTEGER NOT NULL,
    "vector_version" INTEGER NOT NULL DEFAULT 1,
    "local_vector_json" TEXT NOT NULL DEFAULT '',
    "embedding_model" TEXT NOT NULL DEFAULT '',
    "embedding_vector" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_vector_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_behavior_aggregates_user_id_key" ON "user_behavior_aggregates"("user_id");
CREATE UNIQUE INDEX "user_preference_vectors_user_id_key" ON "user_preference_vectors"("user_id");
CREATE UNIQUE INDEX "recipe_vector_snapshots_recipe_feature_id_key" ON "recipe_vector_snapshots"("recipe_feature_id");

-- AddForeignKey
ALTER TABLE "user_behavior_aggregates" ADD CONSTRAINT "user_behavior_aggregates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_preference_vectors" ADD CONSTRAINT "user_preference_vectors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_vector_snapshots" ADD CONSTRAINT "recipe_vector_snapshots_recipe_feature_id_fkey" FOREIGN KEY ("recipe_feature_id") REFERENCES "recipe_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;
