import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser, hasPermission } from "@/lib/auth/guards";
import { BulletinComposer } from "../BulletinComposer";

export default async function NewBulletinPage() {
  const user = await requireUser();
  if (!hasPermission(user, "LICENSED")) redirect("/bulletin");
  return (
    <>
      <PageHeader eyebrow="// Nuevo Bulletin" title="Componer" description="Publica un comunicado oficial. El cuerpo soporta rich text e imágenes en línea." />
      <div className="p-8 max-w-4xl">
        <BulletinComposer mode="create" />
      </div>
    </>
  );
}
