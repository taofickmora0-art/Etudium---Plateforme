import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { ListeComptes } from "@/components/admin/utilisateurs/ListeComptes";
import { MigrationAbsente } from "@/components/admin/utilisateurs/MigrationAbsente";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAuthUser } from "@/lib/auth/current-user";
import { requireSpace } from "@/lib/auth/require-space";
import { lireComptes } from "@/lib/utilisateurs/data";

export const metadata: Metadata = { title: "Utilisateurs · Back-office · Étudium" };

async function Utilisateurs() {
  const moi = await requireSpace("admin");
  const [lecture, connecte] = await Promise.all([lireComptes("", "tous", 1), getAuthUser()]);
  return (
    <PageAdmin titre="Utilisateurs" description="Comptes étudiants et formateurs, avec leur formule et leur statut." fil={[{ label: "Utilisateurs" }]}>
      {lecture.migrationAbsente ? <MigrationAbsente /> : <ListeComptes initial={lecture.donnees} moi={{ id: connecte?.id ?? "", roles: moi.roles }} />}
    </PageAdmin>
  );
}

/** Liste des comptes (spec des utilisateurs, §2) : réservée à l'équipe, rien n'est rendu avant la vérification du rôle. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[760px] rounded-carte" />}>
      <Utilisateurs />
    </Suspense>
  );
}
