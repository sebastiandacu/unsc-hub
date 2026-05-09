"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { notify, notifyAdmins } from "@/lib/notify";
import { syncMemberJoinedTeam, syncMemberLeftTeam } from "./teams-discord-sync";

/**
 * Honorable Discharge: a user in an exclusive team must request to leave.
 * Admins approve/deny. Approval triggers the actual slot release (and the
 * optional move to a new slot, when toSlotId was set on the request).
 */

const requestSchema = z.object({
  fromTeamId: z.string().min(1),
  reason: z.string().trim().min(10, "La razón es muy corta.").max(800),
  toSlotId: z.string().optional().nullable(),
});

export async function requestDischarge(input: z.infer<typeof requestSchema>) {
  const user = await requireUser();
  const data = requestSchema.parse(input);

  // Confirm the user is actually in this team.
  const slot = await prisma.teamSlot.findFirst({
    where: { holderId: user.id, teamId: data.fromTeamId },
    include: { team: { select: { id: true, name: true, allowsMultiMembership: true } } },
  });
  if (!slot) throw new Error("No estás en ese equipo.");
  if (slot.team.allowsMultiMembership) {
    // Non-exclusive teams don't need discharge — the user can just leave.
    throw new Error("Ese equipo no es exclusivo, podés salir directamente sin pedir discharge.");
  }

  // Block duplicate pending requests for the same team.
  const existing = await prisma.dischargeRequest.findFirst({
    where: {
      userId: user.id,
      fromTeamId: data.fromTeamId,
      status: "PENDING",
    },
  });
  if (existing) {
    throw new Error("Ya tenés un pedido de discharge pendiente para este equipo.");
  }

  // If toSlotId set, validate it's a real, vacant slot in a different team.
  if (data.toSlotId) {
    const target = await prisma.teamSlot.findUnique({
      where: { id: data.toSlotId },
      select: { id: true, teamId: true, holderId: true },
    });
    if (!target) throw new Error("El slot destino ya no existe.");
    if (target.teamId === data.fromTeamId) {
      throw new Error("Slot destino inválido (mismo equipo).");
    }
    if (target.holderId) throw new Error("El slot destino ya está ocupado.");
  }

  const created = await prisma.dischargeRequest.create({
    data: {
      userId: user.id,
      fromTeamId: data.fromTeamId,
      toSlotId: data.toSlotId ?? null,
      reason: data.reason,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "discharge.request",
      targetType: "DischargeRequest",
      targetId: created.id,
      payloadJson: { fromTeamId: data.fromTeamId, toSlotId: data.toSlotId ?? null },
    },
  });

  const who = user.nickname ?? user.discordUsername ?? "Operativo";
  await notifyAdmins(
    {
      kind: "discharge.requested",
      title: `📜 Honorable Discharge: ${who} → ${slot.team.name}`,
      body: data.reason.slice(0, 140),
      url: "/admin/teams",
    },
    user.id,
  );

  revalidatePath("/admin/teams");
  revalidatePath(`/roster/teams/${data.fromTeamId}`);
  return { ok: true, id: created.id };
}

export async function reviewDischarge(
  requestId: string,
  approve: boolean,
  note?: string,
) {
  const admin = await requireAdmin();
  const trimmedNote = note?.trim().slice(0, 500) || null;

  const req = await prisma.dischargeRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { select: { id: true, nickname: true, discordUsername: true } },
      fromTeam: { select: { id: true, name: true } },
      toSlot: {
        include: { team: { select: { id: true, name: true, allowsMultiMembership: true } } },
      },
    },
  });
  if (!req) throw new Error("Pedido no encontrado.");
  if (req.status !== "PENDING") throw new Error("Este pedido ya fue procesado.");

  if (approve) {
    // Verify the user is still in fromTeam (might have been kicked).
    const stillIn = await prisma.teamSlot.findFirst({
      where: { holderId: req.userId, teamId: req.fromTeamId },
    });
    if (!stillIn) {
      // Auto-cancel — admin can't approve a stale request.
      await prisma.dischargeRequest.update({
        where: { id: requestId },
        data: {
          status: "CANCELLED",
          reviewedById: admin.id,
          reviewedAt: new Date(),
          reviewNote: "El usuario ya no está en ese equipo.",
        },
      });
      throw new Error("El operativo ya no está en ese equipo (cancelo el pedido).");
    }

    // Release every slot the user holds in fromTeam.
    await prisma.teamSlot.updateMany({
      where: { holderId: req.userId, teamId: req.fromTeamId },
      data: { holderId: null },
    });
    await syncMemberLeftTeam(req.userId, req.fromTeamId);

    // If a target was specified, take it (best-effort — if it got filled
    // in the meantime the discharge still goes through as a pure leave).
    if (req.toSlot) {
      const fresh = await prisma.teamSlot.findUnique({
        where: { id: req.toSlot.id },
        select: { holderId: true, teamId: true },
      });
      if (fresh && !fresh.holderId) {
        await prisma.teamSlot.update({
          where: { id: req.toSlot.id },
          data: { holderId: req.userId },
        });
        await syncMemberJoinedTeam(req.userId, fresh.teamId);
      }
    }
  }

  await prisma.dischargeRequest.update({
    where: { id: requestId },
    data: {
      status: approve ? "APPROVED" : "REJECTED",
      reviewedById: admin.id,
      reviewedAt: new Date(),
      reviewNote: trimmedNote,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: approve ? "discharge.approve" : "discharge.reject",
      targetType: "DischargeRequest",
      targetId: requestId,
      payloadJson: trimmedNote ? { note: trimmedNote } : undefined,
    },
  });

  const targetLabel = req.toSlot
    ? ` y transferencia a ${req.toSlot.team.name}`
    : "";
  await notify(req.userId, {
    kind: approve ? "discharge.approved" : "discharge.rejected",
    title: approve
      ? `✅ Honorable Discharge aprobada: ${req.fromTeam.name}${targetLabel}`
      : `✗ Honorable Discharge rechazada: ${req.fromTeam.name}`,
    body: trimmedNote ?? (approve ? "Tu pedido fue aprobado." : "Tu pedido fue rechazado."),
    url: `/roster/teams/${req.fromTeamId}`,
  });

  revalidatePath("/admin/teams");
  revalidatePath(`/roster/teams/${req.fromTeamId}`);
  if (req.toSlot) revalidatePath(`/roster/teams/${req.toSlot.team.id}`);
  return { ok: true };
}

export async function cancelDischarge(requestId: string) {
  const user = await requireUser();
  const req = await prisma.dischargeRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, status: true, fromTeamId: true },
  });
  if (!req) throw new Error("No encontrado.");
  if (req.userId !== user.id) throw new Error("No es tu pedido.");
  if (req.status !== "PENDING") throw new Error("Este pedido ya fue procesado.");

  await prisma.dischargeRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED", reviewedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "discharge.cancel",
      targetType: "DischargeRequest",
      targetId: requestId,
    },
  });

  revalidatePath("/admin/teams");
  revalidatePath(`/roster/teams/${req.fromTeamId}`);
}
