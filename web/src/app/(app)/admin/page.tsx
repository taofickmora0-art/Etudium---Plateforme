import { Suspense } from "react";
import type { Metadata } from "next";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { ResumeBackOffice } from "@/components/admin/ResumeBackOffice";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Back-office · Étudium" };

async function AccueilAdmin() {
  await requireSpace("admin");
  return (
    <PageAdmin titre="Back-office" description="Saisissez les parcours, les formateurs et les formations. Les étudiants ne voient que les formations publiées.">
      <ResumeBackOffice />
    </PageAdmin>
  );
}

/** Accueil du back-office (spec du lot 1, §10) : réservé à l'équipe, rien n'est rendu avant la vérification du rôle. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-60 max-w-[680px] rounded-carte" />}>
      <AccueilAdmin />
    </Suspense>
  );
}
