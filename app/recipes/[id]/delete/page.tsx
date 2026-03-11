import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DeleteForm } from "./delete-form";

export default async function DeleteRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) redirect("/");
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) redirect("/");

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Delete recipe</h2>
      <p className="mt-2 text-sm text-[#7f8c8d]">
        Are you sure you want to delete &ldquo;{recipe.title}&rdquo;?
      </p>
      <DeleteForm recipeId={id} />
      <p className="mt-4">
        <Link
          href={`/recipes/${id}`}
          className="text-sm text-[#5b3b2a] hover:underline"
        >
          Cancel
        </Link>
      </p>
    </div>
  );
}
