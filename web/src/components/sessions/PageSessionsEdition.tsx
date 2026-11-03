import { notFound } from "next/navigation";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { moiCommunaute } from "@/components/communaute/ContenuCommunaute";
import { lireEspaces } from "@/lib/communaute/data";
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
  return <PageAdmin {...cadre}>{lecture.migrationAbsente ? <MigrationSessionsAbsente espace={espace} /> : <ListeSessionsEdition espace={espace} liste={lecture.donnees} />}</PageAdmin>;
}

/** Programmer une session, ou modifier celle-ci (`id`). La page vérifie le rôle avant. */
export async function PageFormulaireSession({ espace, id }: { espace: EspaceEdition; id?: string }) {
  const titre = id ? "Modifier la session" : "Nouvelle session";
  const cadre = { titre, racine: racineSessions(espace), fil: [filSessions(espace), { label: titre }] };
  const bandeau = await bandeauFormateur(espace);
  if (bandeau) return <PageAdmin {...cadre}>{bandeau}</PageAdmin>;
  const [tousParcours, formateurs, detail, moi, espaces] = await Promise.all([
    listParcours(),
    espace === "admin" ? listFormateurs() : Promise.resolve([]),
    id ? lireSessionDetail(id) : Promise.resolve(null),
    // L'auteur de la publication de la session (aperçu) et le dossier de son affiche.
    moiCommunaute(),
    // Un formateur ne publie que dans les espaces qui lui sont ouverts (ceux de ses formations) ; la base le revérifie.
    espace === "formateur" ? lireEspaces().catch(() => null) : Promise.resolve(null),
  ]);
  const ouverts = espaces && !espaces.migrationAbsente ? new Set(espaces.donnees.filter((e) => e.ouvert && e.id).map((e) => e.id)) : null;
  // Seulement les parcours proposés (actifs) ; pour un formateur, ceux de ses espaces ouverts.
  const parcours = tousParcours.filter((p) => p.actif && (!ouverts || ouverts.has(p.id)));
  if (detail?.migrationAbsente) {
    return (
      <PageAdmin {...cadre}>
        <MigrationSessionsAbsente espace={espace} />
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
        moi={moi}
      />
    </PageAdmin>
  );
}
