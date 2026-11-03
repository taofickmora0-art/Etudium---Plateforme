import { Banner } from "@/components/ui/Banner";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { lireGroupeFormation } from "@/lib/groupes/data";
import { MIGRATION_GROUPES } from "@/lib/groupes/regles";
import type { GroupeDeFormation } from "@/lib/groupes/types";
import type { Lecture } from "@/lib/utilisateurs/types";
import { ReglageGroupeFormation } from "./ReglageGroupeFormation";

/** L'état du groupe d'une formation pour son réglage ; une erreur de lecture (ce n'est pas l'essentiel de la fiche) : rien. */
export async function lireReglageGroupe(formationId: string): Promise<Lecture<GroupeDeFormation | null>> {
  return lireGroupeFormation(formationId).catch(() => ({ migrationAbsente: false as const, donnees: null }));
}

/**
 * Le réglage « Groupe de discussion » d'une formation (migration 0075), lu par la page (lireReglageGroupe). Avant la
 * migration : le bandeau de la migration au back-office, le message neutre dans l'espace formateur.
 */
export function GroupeDeLaFormation({ formationId, espace, lu }: { formationId: string; espace: "admin" | "formateur"; lu: Lecture<GroupeDeFormation | null> }) {
  if (lu.migrationAbsente) {
    return (
      <div className="max-w-[680px]">
        {espace === "admin" ? <Banner tone="attention" title={`Groupe de discussion : ${MIGRATION_GROUPES}`} /> : <BandeauIndisponible />}
      </div>
    );
  }
  if (!lu.donnees) return null;
  return <ReglageGroupeFormation formationId={formationId} initial={lu.donnees} espace={espace} />;
}
