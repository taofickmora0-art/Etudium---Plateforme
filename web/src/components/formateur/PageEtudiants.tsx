import { PageAdmin } from "@/components/admin/PageAdmin";
import { listFormations } from "@/lib/admin/data";
import { lireMaFiche } from "@/lib/formateur/data";
import { lireSuivi } from "@/lib/formateur/suivi";
import { MigrationFormateurAbsente, MigrationSuiviAbsente, RACINE_FORMATEUR, SansFiche } from "./cadre";
import { ListeEtudiants } from "./ListeEtudiants";

const cadre = {
  titre: "Étudiants",
  description: "La progression des étudiants de vos formations.",
  racine: RACINE_FORMATEUR,
  fil: [{ label: "Étudiants" }],
};

/** La page « Étudiants » de l'espace formateur (spec, §3). La page vérifie le rôle avant (requireSpace). */
export async function PageEtudiants() {
  const fiche = await lireMaFiche();
  if (fiche.migrationAbsente) {
    return (
      <PageAdmin {...cadre}>
        <MigrationFormateurAbsente />
      </PageAdmin>
    );
  }
  if (!fiche.fiche) {
    return (
      <PageAdmin {...cadre}>
        <SansFiche />
      </PageAdmin>
    );
  }
  const [suivi, formations] = await Promise.all([lireSuivi("", null, "tous", 1), listFormations({ formateurId: fiche.fiche })]);
  return (
    <PageAdmin {...cadre}>
      {suivi.migrationAbsente ? (
        <MigrationSuiviAbsente />
      ) : (
        <ListeEtudiants initial={suivi.donnees} formations={formations.map((f) => ({ id: f.id, titre: f.titre }))} />
      )}
    </PageAdmin>
  );
}
