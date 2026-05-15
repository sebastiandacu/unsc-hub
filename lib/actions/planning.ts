"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";

const SETTINGS_ID = "default";

const nameSchema = z.string().trim().min(2).max(40);

export async function getPlanetName(): Promise<string> {
  const row = await prisma.planetSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { planetName: true },
  });
  return row?.planetName ?? "ARCADIA-VII";
}

export async function setPlanetName(name: string): Promise<void> {
  const admin = await requireAdmin();
  const trimmed = nameSchema.parse(name).toUpperCase();
  await prisma.planetSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, planetName: trimmed },
    update: { planetName: trimmed },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "planning.setPlanetName",
      targetType: "PlanetSettings",
      targetId: SETTINGS_ID,
      payloadJson: { planetName: trimmed },
    },
  });
  revalidatePath("/roster/schedule");
}
