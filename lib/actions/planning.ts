"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";

const SETTINGS_ID = "default";

const planetNameSchema = z.string().trim().min(2).max(40);
// Ship name allows the "·" separator and class spec, so a touch more room.
const shipNameSchema = z.string().trim().min(2).max(80);

const DEFAULTS = {
  planetName: "ARCADIA-VII",
  shipName: "UNSC GORGON-04 · CLASE FRIGATA",
};

export async function getPlanningSettings(): Promise<{
  planetName: string;
  shipName: string;
}> {
  const row = await prisma.planetSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { planetName: true, shipName: true },
  });
  return {
    planetName: row?.planetName ?? DEFAULTS.planetName,
    shipName: row?.shipName ?? DEFAULTS.shipName,
  };
}

/** Back-compat alias for callers that only want the planet name. */
export async function getPlanetName(): Promise<string> {
  const s = await getPlanningSettings();
  return s.planetName;
}

export async function setPlanetName(name: string): Promise<void> {
  const admin = await requireAdmin();
  const trimmed = planetNameSchema.parse(name).toUpperCase();
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

export async function setShipName(name: string): Promise<void> {
  const admin = await requireAdmin();
  const trimmed = shipNameSchema.parse(name).toUpperCase();
  await prisma.planetSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, shipName: trimmed },
    update: { shipName: trimmed },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "planning.setShipName",
      targetType: "PlanetSettings",
      targetId: SETTINGS_ID,
      payloadJson: { shipName: trimmed },
    },
  });
  revalidatePath("/roster/schedule");
}
