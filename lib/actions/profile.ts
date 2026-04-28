"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

const schema = z.object({
  nickname: z.string().trim().max(40).optional().nullable(),
  bio: z.string().trim().max(1000).optional().nullable(),
});

export async function updateOwnProfile(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const data = schema.parse(input);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      nickname: data.nickname?.trim() || null,
      bio: data.bio?.trim() || null,
    },
  });
  revalidatePath("/profile");
  revalidatePath(`/roster/${user.id}`);
}
