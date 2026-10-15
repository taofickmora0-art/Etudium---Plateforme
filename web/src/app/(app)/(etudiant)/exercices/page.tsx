import { Suspense } from "react";
import type { Metadata } from "next";
import { ListeExercices } from "@/components/exercices/ListeExercices";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Banner } from "@/components/ui/Banner";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading, Lead } from "@/components/ui/Text";
import { lireMesExercices, MIGRATION_EXERCICES } from "@/lib/exercices/data";

export const metadata: Metadata = { title: "Exercices · Étudium" };

async function Contenu() {
  const lecture = await lireMesExercices();
  if (lecture.migrationAbsente) {
    return (
      <Banner tone="attention" title="Les exercices ne sont pas encore dans la base.">
        {MIGRATION_EXERCICES}
      </Banner>
    );
  }
  return <ListeExercices exercices={lecture.donnees} />;
}

/** Exercices (lot 3, étape B ; NdExercices) : les travaux rendus et leur correction. */
export default function Page() {
  return (
    <div className="flex max-w-[960px] min-w-0 flex-col gap-6">
      <div>
        <Heading level="page">Exercices</Heading>
        <Lead className="mt-2.5">Vos travaux pratiques, corrigés par vos formateurs. Un exercice validé compte pour votre certificat.</Lead>
      </div>
      <Suspense fallback={<Skeleton className="h-60 rounded-carte" />}>
        <Contenu />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </div>
  );
}
