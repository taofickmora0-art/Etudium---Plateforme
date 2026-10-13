import Link from "next/link";
import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { List, ListRow } from "@/components/ui/ListRow";
import { Tag } from "@/components/ui/Tag";
import { listFormations } from "@/lib/admin/data";
import type { FormationResume } from "@/lib/admin/types";
import { ETATS, TON_ETAT } from "@/lib/contenus/etat";
import { libelleNiveau } from "@/lib/contenus/libelles";
import { lireMaFiche } from "@/lib/formateur/data";
import { MES_FORMATIONS, MigrationFormateurAbsente, RACINE_FORMATEUR, SansFiche } from "./cadre";

const NOUVELLE = (
  <Button asChild>
    <Link href="/formateur/formations/nouvelle">Nouvelle formation</Link>
  </Button>
);

const sousTitre = (f: FormationResume) =>
  [f.parcours.join(", ") || "Sans parcours", libelleNiveau(f.niveau), `${f.nbLecons} ${f.nbLecons > 1 ? "leçons" : "leçon"}`].join(" · ");

const cadre = { titre: "Mes formations", fil: [{ label: MES_FORMATIONS.label }], racine: RACINE_FORMATEUR };

/**
 * « Mes formations » (spec de l'espace formateur, §3) : les formations de sa fiche formateur, les plus récemment
 * modifiées d'abord, avec leur état. La page vérifie le rôle avant (requireSpace).
 */
export async function MesFormations() {
  const lecture = await lireMaFiche();
  if (lecture.migrationAbsente) {
    return (
      <PageAdmin {...cadre}>
        <MigrationFormateurAbsente />
      </PageAdmin>
    );
  }
  if (!lecture.fiche) {
    return (
      <PageAdmin {...cadre}>
        <SansFiche />
      </PageAdmin>
    );
  }
  let formations: FormationResume[];
  try {
    formations = await listFormations({ formateurId: lecture.fiche });
  } catch (erreur) {
    return <PageAdmin {...cadre}>{siTablesAbsentes(erreur)}</PageAdmin>;
  }
  return (
    <PageAdmin {...cadre} description="Créez vos formations, puis envoyez-les en relecture : un admin les publie." action={NOUVELLE}>
      <div className="flex max-w-[680px] flex-col gap-4">
        {formations.length === 0 ? (
          <EmptyState
            icon={BookOpen01Icon}
            title="Aucune formation pour le moment"
            description="Vous n’avez pas encore de formation. Créez-en une : elle reste un brouillon tant que vous ne l’envoyez pas en relecture."
          />
        ) : (
          <List label="Mes formations">
            {formations.map((f) => (
              <ListRow
                key={f.id}
                leading={<IconTile icon={BookOpen01Icon} />}
                title={f.titre}
                subtitle={sousTitre(f)}
                trailing={<Tag tone={TON_ETAT[f.etat]}>{ETATS[f.etat]}</Tag>}
                href={`/formateur/formations/${f.id}`}
              />
            ))}
          </List>
        )}
      </div>
    </PageAdmin>
  );
}
