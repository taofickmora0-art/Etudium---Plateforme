import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditeurLecon } from "@/components/admin/EditeurLecon";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Skeleton } from "@/components/ui/Skeleton";
import { getLeconAdmin } from "@/lib/admin/data";
import type { LeconAdmin } from "@/lib/admin/types";
import { requireSpace } from "@/lib/auth/require-space";
import { lireQuizEditeur } from "@/lib/quiz/data";

export const metadata: Metadata = { title: "Leçon · Back-office · Étudium" };

type Params = { params: Promise<{ id: string; leconId: string }> };

async function FicheLecon({ params }: Params) {
  await requireSpace("admin");
  const { id, leconId } = await params;
  let lecon: LeconAdmin | null;
  try {
    lecon = await getLeconAdmin(leconId);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  // Une leçon n'est ouverte que sous sa propre formation.
  if (!lecon || lecon.formationId !== id) notFound();
  // Un quiz : ses questions, avec les bonnes réponses (lot 3).
  const quiz = lecon.type === "quiz" ? await lireQuizEditeur(lecon.id) : undefined;
  // L'éditeur en deux colonnes (refonte des formations, §3.4) : sa barre du haut ramène aux leçons.
  return (
    <div className="flex flex-col">
      <h1 className="sr-only">{`${quiz ? "Modifier le quiz" : "Modifier la leçon"} : ${lecon.titre}`}</h1>
      <EditeurLecon lecon={lecon} quiz={quiz} />
    </div>
  );
}

export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <FicheLecon params={params} />
    </Suspense>
  );
}
