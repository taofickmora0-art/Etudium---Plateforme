import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { ListeComptes } from "@/components/admin/utilisateurs/ListeComptes";
import { MigrationAbsente } from "@/components/admin/utilisateurs/MigrationAbsente";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";
import { lireComptes } from "@/lib/utilisateurs/data";

export const metadata: Metadata = { title: "Utilisateurs · Back-office · Étudium" };

async function Utilisateurs() {
  await requireSpace("admin");
  const lecture = await lireComptes("", "tous", 1);
  return (
    <PageAdmin titre="Utilisateurs" description="Les comptes des étudiants, des formateurs et de l’équipe : rôles, activité, suspension." fil={[{ label: "Utilisateurs" }]}>
      {lecture.migrationAbsente ? <MigrationAbsente /> : <ListeComptes initial={lecture.donnees} />}
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
