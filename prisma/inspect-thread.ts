import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("usage: tsx prisma/inspect-thread.ts <threadId>");
    process.exit(1);
  }
  const t = await prisma.wallThread.findUnique({
    where: { id },
    select: { id: true, title: true, bodyJson: true, headerImageUrl: true, bannerImageUrl: true },
  });
  if (!t) {
    console.log("not found");
    return;
  }
  console.log("title:", t.title);
  console.log("headerImageUrl:", t.headerImageUrl);
  console.log("bannerImageUrl:", t.bannerImageUrl);
  console.log("bodyJson (raw):");
  console.log(JSON.stringify(t.bodyJson, null, 2));
  console.log("");
  console.log("--- image-node hunt ---");
  const recurse = (n: unknown, path = "$") => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] };
    if (node.type === "image") {
      console.log(`${path}: type=image attrs=${JSON.stringify(node.attrs)}`);
    }
    if (Array.isArray(node.content)) {
      node.content.forEach((c, i) => recurse(c, `${path}.content[${i}]`));
    }
  };
  recurse(t.bodyJson);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
