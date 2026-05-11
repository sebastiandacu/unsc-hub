"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { randomBytes } from "node:crypto";

/**
 * Generate a memorable code: <SLUG>-<4 chars from base32>.
 * SLUG is up to 8 characters from the label, A-Z + digits.
 * Resulting codes look like "HALOCE-7XK2" or "PARTNER-9JQ4".
 */
function generateCode(label: string): string {
  const slug = label
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "INVITE";
  // 4 base32-ish chars (avoid I/O/0/1 to dodge confusion)
  const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(4);
  let suffix = "";
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  return `${slug}-${suffix}`;
}

const createSchema = z.object({
  label: z.string().trim().min(2).max(80),
  maxUses: z.number().int().positive().max(10_000).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function createInvite(input: z.infer<typeof createSchema>) {
  const admin = await requireAdmin();
  const data = createSchema.parse(input);

  // Generate unique code (retry on collision — extremely rare).
  let code: string;
  let attempts = 0;
  do {
    if (attempts++ > 5) throw new Error("No pude generar un código único, reintentá.");
    code = generateCode(data.label);
  } while (await prisma.inviteCode.findUnique({ where: { code }, select: { id: true } }));

  const created = await prisma.inviteCode.create({
    data: {
      code,
      label: data.label,
      createdById: admin.id,
      maxUses: data.maxUses ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "invite.create",
      targetType: "InviteCode",
      targetId: created.id,
      payloadJson: { code, label: data.label, maxUses: data.maxUses ?? null },
    },
  });
  revalidatePath("/admin/discord");
  return { id: created.id, code: created.code };
}

export async function revokeInvite(id: string) {
  const admin = await requireAdmin();
  await prisma.inviteCode.update({
    where: { id },
    data: { revoked: true },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "invite.revoke",
      targetType: "InviteCode",
      targetId: id,
    },
  });
  revalidatePath("/admin/discord");
}

export async function deleteInvite(id: string) {
  const admin = await requireAdmin();
  await prisma.inviteCode.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "invite.delete",
      targetType: "InviteCode",
      targetId: id,
    },
  });
  revalidatePath("/admin/discord");
}

/**
 * Lightweight server validation used by the /login page to render
 * "te estás uniendo via invitación: X" before the user even clicks
 * Continue. Doesn't increment uses — that happens in events.signIn
 * after the OAuth round-trip succeeds.
 */
export async function validateInvite(code: string): Promise<
  | { ok: true; label: string; remaining: number | null }
  | { ok: false; reason: string }
> {
  const norm = code.trim().toUpperCase();
  if (!norm) return { ok: false, reason: "empty" };
  const inv = await prisma.inviteCode.findUnique({
    where: { code: norm },
    select: { revoked: true, expiresAt: true, maxUses: true, uses: true, label: true },
  });
  if (!inv) return { ok: false, reason: "Código no encontrado." };
  if (inv.revoked) return { ok: false, reason: "Este código fue revocado." };
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "Este código expiró." };
  }
  if (inv.maxUses !== null && inv.uses >= inv.maxUses) {
    return { ok: false, reason: "Este código ya alcanzó el límite de usos." };
  }
  return {
    ok: true,
    label: inv.label,
    remaining: inv.maxUses === null ? null : inv.maxUses - inv.uses,
  };
}
