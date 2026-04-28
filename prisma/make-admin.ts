import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
  const result = await prisma.user.updateMany({ data: { permission: "ADMIN" } });
  console.log(`Promoted ${result.count} user(s) to ADMIN`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
