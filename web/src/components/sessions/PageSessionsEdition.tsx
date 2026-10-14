import { notFound } from "next/navigation";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { MigrationFormateurAbsente, SansFiche } from "@/components/formateur/cadre";
import { Banner } from "@/components/ui/Banner";
import { listFormateurs, listParcours } from "@/lib/admin/data";
import type { EspaceEdition } from "@/lib/admin/espace";
import { lireMaFiche } from "@/lib/formateur/data";
import { lireSessionDetail, lireSessionsAnimees, lireSessionsEquipe } from "@/lib/sessions/data";
import { terminee } from "@/lib/sessions/regles";
import { filSessions, MigrationSessionsAbsente, racineSessions } from "./cadre";
import { FormulaireSession } from "./FormulaireSession";
import { ListeSessionsEdition } from "./ListeSessionsEdition";

const DESCRIPTIONS: Record<EspaceEdition, string> = {
  formateur: "Programmez vos sessions live et suivez leurs inscriptions.",
  admin: "Toutes les sessions live : programmez-en, modifiez-les ou annulez-les.",
};

/** Le formateur sans fiche, ou avant la 0014 : un bandeau au lieu de la page (l'équipe n'en a pas besoin). */
async function bandeauFormateur(espace: EspaceEdition) {
  if (espace !== "formateur") return null;
  const fiche = await lireMaFiche();
  if (fiche.migrationAbsente) return <MigrationFormateurAbsente />;
  return fiche.fiche ? null : <SansFiche />;
}

/** La liste des sessions : celles du formateur, ou toutes au back-office. La page vérifie le rôle avant. */
export async function PageSessionsEdition({ espace }: { espace: EspaceEdition }) {
  const cadre = { titre: "Sessions live", description: DESCRIPTIONS[espace], racine: racineSessions(espace), fil: [{ label: "Sessions live" }] };
  const bandeau = await bandeauFormateur(espace);
  if (bandeau) return <PageAdmin {...cadre}>{bandeau}</PageAdmin>;
  const lecture = espace === "formateur" ? await lireSessionsAnimees() : await lireSessionsEquipe();
  return <PageAdmin {...cadre}>{lecture.migrationAbsente ? <MigrationSessionsAbsente /> : <ListeSessionsEdition espace={espace} liste={lecture.donnees} />}</PageAdmin>;
}

/** Programmer une session, ou modifier celle-ci (`id`). La page vérifie le rôle avant. */
export async function PageFormulaireSession({ espace, id }: { espace: EspaceEdition; id?: string }) {
  const titre = id ? "Modifier la session" : "Nouvelle session";
  const cadre = { titre, racine: racineSessions(espace), fil: [filSessions(espace), { label: titre }] };
  const bandeau = await bandeauFormateur(espace);
  if (bandeau) return <PageAdmin {...cadre}>{bandeau}</PageAdmin>;
  const [parcours, formateurs, detail] = await Promise.all([
    listParcours(),
    espace === "admin" ? listFormateurs() : Promise.resolve([]),
    id ? lireSessionDetail(id) : Promise.resolve(null),
  ]);
  if (detail?.migrationAbsente) {
    return (
      <PageAdmin {...cadre}>
        <MigrationSessionsAbsente />
      </PageAdmin>
    );
  }
  const initial = detail && !detail.migrationAbsente ? detail.donnees : undefined;
  if (id && !initial) notFound();
  if (initial && (initial.statut === "annulee" || terminee(initial, new Date()))) {
    return (
      <PageAdmin {...cadre}>
        <Banner tone="attention" title={initial.statut === "annulee" ? "Cette session est annulée." : "Une session terminée ne se modifie plus."} />
      </PageAdmin>
    );
  }
  return (
    <PageAdmin {...cadre}>
      <FormulaireSession
        espace={espace}
        parcours={parcours.map((p) => ({ id: p.id, nomCourt: p.nomCourt }))}
        formateurs={espace === "admin" ? formateurs.map((f) => ({ id: f.id, nom: f.nom })) : undefined}
        initial={initial ?? undefined}
      />
    </PageAdmin>
  );
}
