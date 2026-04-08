-- CreateEnum
CREATE TYPE "FeedbackSignal" AS ENUM ('like', 'dislike', 'skip', 'add_to_plan', 'cooked', 'rate');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "dietaryRestrictions" TEXT NOT NULL DEFAULT '',
    "fitnessGoal" TEXT NOT NULL DEFAULT '',
    "calorieTarget" INTEGER,
    "proteinTarget" INTEGER,
    "carbTarget" INTEGER,
    "fatTarget" INTEGER,
    "preferredDomains" TEXT NOT NULL DEFAULT '',
    "blockedDomains" TEXT NOT NULL DEFAULT '',
    "favoriteIngredients" TEXT NOT NULL DEFAULT '',
    "dislikedIngredients" TEXT NOT NULL DEFAULT '',
    "explorationRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_features" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "source_domain" TEXT NOT NULL DEFAULT '',
    "normalized_ingredients" TEXT NOT NULL DEFAULT '',
    "normalized_tags" TEXT NOT NULL DEFAULT '',
    "calories" INTEGER,
    "protein" INTEGER,
    "carbs" INTEGER,
    "fat" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_feedback" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER,
    "candidate_url" TEXT,
    "source_domain" TEXT NOT NULL DEFAULT '',
    "signal" "FeedbackSignal" NOT NULL,
    "rating" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestion_runs" (
    "id" SERIAL NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "input_json" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestion_items" (
    "id" SERIAL NOT NULL,
    "run_id" INTEGER NOT NULL,
    "recipe_id" INTEGER,
    "candidate_url" TEXT,
    "source_domain" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason_json" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "suggestion_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_recipe_candidates" (
    "id" SERIAL NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_domain" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ingredients_text" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'other',
    "tags" TEXT NOT NULL DEFAULT '',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imported_recipe_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "web_recipe_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_name_key" ON "user_profiles"("name");
CREATE UNIQUE INDEX "recipe_features_recipe_id_key" ON "recipe_features"("recipe_id");
CREATE INDEX "recipe_features_source_domain_idx" ON "recipe_features"("source_domain");
CREATE INDEX "recipe_feedback_recipe_id_created_at_idx" ON "recipe_feedback"("recipe_id", "created_at");
CREATE INDEX "recipe_feedback_source_domain_created_at_idx" ON "recipe_feedback"("source_domain", "created_at");
CREATE INDEX "suggestion_runs_profile_id_created_at_idx" ON "suggestion_runs"("profile_id", "created_at");
CREATE INDEX "suggestion_items_run_id_score_idx" ON "suggestion_items"("run_id", "score");
CREATE INDEX "suggestion_items_recipe_id_idx" ON "suggestion_items"("recipe_id");
CREATE UNIQUE INDEX "web_recipe_candidates_source_url_key" ON "web_recipe_candidates"("source_url");
CREATE INDEX "web_recipe_candidates_source_domain_confidence_idx" ON "web_recipe_candidates"("source_domain", "confidence");

-- AddForeignKey
ALTER TABLE "recipe_features" ADD CONSTRAINT "recipe_features_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_feedback" ADD CONSTRAINT "recipe_feedback_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "suggestion_runs" ADD CONSTRAINT "suggestion_runs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suggestion_items" ADD CONSTRAINT "suggestion_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "suggestion_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suggestion_items" ADD CONSTRAINT "suggestion_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
