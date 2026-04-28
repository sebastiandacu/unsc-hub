import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { TemplatesAdmin } from "./TemplatesAdmin";

export default async function AdminTemplatesPage() {
  await requireAdmin();
  const [medals, patches] = await Promise.all([
    prisma.medalTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.patchTemplate.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="// Admin · Templates"
        title="Plantillas de Condecoraciones"
        description="Pre-define medallas y parches para otorgar con un click desde el panel de usuarios."
      />
      <div className="p-8">
        <TemplatesAdmin medals={medals} patches={patches} />
      </div>
    </>
  );
}
