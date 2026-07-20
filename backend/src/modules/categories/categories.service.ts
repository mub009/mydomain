import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";

export async function listCategories() {
  return prisma.category.findMany({
    where: { parentId: null },
    include: { children: true },
    orderBy: { name: "asc" },
  });
}

export async function getCategoryBySlug(slug: string) {
  const category = await prisma.category.findUnique({ where: { slug }, include: { children: true } });
  if (!category) throw AppError.notFound("Category not found");
  return category;
}

export async function createCategory(data: {
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  parentId?: string;
}) {
  return prisma.category.create({ data });
}

export async function updateCategory(id: string, data: Partial<{ name: string; slug: string; description: string; iconUrl: string; parentId: string }>) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw AppError.notFound("Category not found");
  return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw AppError.notFound("Category not found");
  await prisma.category.delete({ where: { id } });
}
