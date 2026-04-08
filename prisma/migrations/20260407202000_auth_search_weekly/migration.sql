-- CreateEnum
CREATE TYPE "WeeklyMealStatus" AS ENUM ('planned', 'cooked', 'skipped');

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN "user_id" INTEGER;

-- CreateTable
CREATE TABLE "app_users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_sessions" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "weekly_meal_plans" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "planned_for" TIMESTAMP(3) NOT NULL,
    "status" "WeeklyMealStatus" NOT NULL DEFAULT 'planned',
    "rating" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "reminder_email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "weekly_meal_plans_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "user_profiles" ADD COLUMN "user_id" INTEGER;

-- Indexes
CREATE UNIQUE INDEX "app_users_email_key" ON "app_users"("email");
CREATE UNIQUE INDEX "user_sessions_token_key" ON "user_sessions"("token");
CREATE INDEX "user_sessions_user_id_expires_at_idx" ON "user_sessions"("user_id", "expires_at");
CREATE INDEX "weekly_meal_plans_user_id_planned_for_idx" ON "weekly_meal_plans"("user_id", "planned_for");
CREATE INDEX "weekly_meal_plans_recipe_id_planned_for_idx" ON "weekly_meal_plans"("recipe_id", "planned_for");
CREATE INDEX "recipes_user_id_created_at_idx" ON "recipes"("user_id", "created_at");
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- Foreign keys
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_meal_plans" ADD CONSTRAINT "weekly_meal_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_meal_plans" ADD CONSTRAINT "weekly_meal_plans_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
