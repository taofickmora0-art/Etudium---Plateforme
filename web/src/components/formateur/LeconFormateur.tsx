import { notFound } from "next/navigation";
import { EditeurLecon } from "@/components/admin/EditeurLecon";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { getLeconAdmin } from "@/lib/admin/data";
import type { LeconAdmin } from "@/lib/admin/types";
import { estMaFormation } from "@/lib/formateur/data";
import { lireQuizEditeur } from "@/lib/quiz/data";

type Params = { params: Promise<{ id: string; leconId: string }> };

/** Une leçon d'une de ses formations, dans l'espace formateur (même page qu'au back-office). */
export async function LeconFormateur({ params }: Params) {
  const { id, leconId } = await params;
  if (!(await estMaFormation(id))) notFound();
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
  return (
    <div className="flex flex-col">
      <h1 className="sr-only">{`${quiz ? "Modifier le quiz" : "Modifier la leçon"} : ${lecon.titre}`}</h1>
      <EditeurLecon lecon={lecon} base="/formateur/formations" quiz={quiz} />
    </div>
  );
}
