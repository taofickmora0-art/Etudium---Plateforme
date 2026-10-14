import { PageAdmin } from "@/components/admin/PageAdmin";
import { Section } from "@/components/admin/utilisateurs/Section";
import { Banner } from "@/components/ui/Banner";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { lireAnnonces } from "@/lib/notifications/data";
import { heure } from "@/lib/notifications/temps";
import { dateCourte } from "@/lib/utilisateurs/regles";
import { FormulaireAnnonce } from "./FormulaireAnnonce";

const COLONNES = ["Date", "Titre", "Auteur", "Destinataires"];

/**
 * La rubrique Annonces du back-office (spec des notifications, §3) : le formulaire, puis les annonces envoyées.
 * La page vérifie le rôle avant (requireSpace).
 */
export async function PageAnnonces() {
  const cadre = { titre: "Annonces", description: "Envoyez une notification à tous les comptes d’Étudium.", fil: [{ label: "Annonces" }] };
  const lecture = await lireAnnonces();
  if (lecture.migrationAbsente) {
    return (
      <PageAdmin {...cadre}>
        <Banner tone="attention" title="Les annonces ne sont pas encore dans la base.">
          Appliquez la migration 0016 (guide « Ce qui te revient », section 21).
        </Banner>
      </PageAdmin>
    );
  }
  const annonces = lecture.donnees;

  return (
    <PageAdmin {...cadre}>
      <div className="flex max-w-[960px] min-w-0 flex-col gap-5">
        <Section titre="Nouvelle annonce">
          <FormulaireAnnonce />
        </Section>
        <Section titre="Annonces envoyées">
          {annonces.length === 0 ? (
            <p className="m-0 text-sm leading-[22px] text-discret">Aucune annonce envoyée.</p>
          ) : (
            <TableauListe nom="Annonces envoyées" nomCadre="Tableau des annonces envoyées" colonnes={COLONNES} largeurMin={720}>
              {annonces.map((a) => (
                <tr key={a.id}>
                  <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{`${dateCourte(a.creeLe)} à ${heure(a.creeLe)}`}</td>
                  <td className={`${CELLULE_TABLEAU} font-medium wrap-anywhere text-encre`}>{a.titre}</td>
                  <td className={CELLULE_TABLEAU}>{a.auteur}</td>
                  <td className={CELLULE_TABLEAU}>{a.destinataires.toLocaleString("fr-FR")}</td>
                </tr>
              ))}
            </TableauListe>
          )}
        </Section>
      </div>
    </PageAdmin>
  );
}
