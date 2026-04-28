import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { unit } from "../config/unit";

const prisma = new PrismaClient();

async function main() {
  for (const [i, c] of unit.defaultWallCategories.entries()) {
    await prisma.wallCategory.upsert({
      where: { slug: c.slug },
      create: { ...c, sortOrder: i },
      update: { name: c.name, color: c.color, description: c.description, sortOrder: i },
    });
  }
  console.log(`Seeded ${unit.defaultWallCategories.length} wall categories`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
