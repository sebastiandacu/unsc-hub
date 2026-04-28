import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser, hasPermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { BulletinComposer } from "../BulletinComposer";

export default async function NewBulletinPage() {
  const user = await requireUser();
  if (!hasPermission(user, "LICENSED")) redirect("/bulletin");

  const teams = await prisma.team.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      callsign: true,
      color: true,
      category: { select: { name: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="NUEVO BOLETÍN"
        title="Componer."
        description="Publicá un comunicado oficial. El cuerpo soporta rich text, imágenes en línea y restricción a equipos específicos."
      />
      <div className="px-7 pb-7 max-w-4xl">
        <BulletinComposer
          mode="create"
          teams={teams.map((t) => ({
            id: t.id,
            name: t.name,
            callsign: t.callsign,
            color: t.color,
            categoryName: t.category?.name ?? null,
          }))}
        />
      </div>
    </>
  );
}
