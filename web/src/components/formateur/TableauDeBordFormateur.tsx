import Link from "next/link";
import { Certificate01Icon, CourseIcon, Target02Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { AVENIR, Carte, GRILLE_CHIFFRES, RANGEE, Tuile } from "@/components/tableau/Blocs";
import { Avatar } from "@/components/ui/Avatar";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { Tag } from "@/components/ui/Tag";
import { ETATS, TON_ETAT } from "@/lib/contenus/etat";
import { lireMaFiche } from "@/lib/formateur/data";
import { inactivite } from "@/lib/formateur/regles-suivi";
import { lireTableauDeBordFormateur } from "@/lib/formateur/suivi";
import { initialesCompte, nomAffiche } from "@/lib/utilisateurs/regles";
import { MigrationFormateurAbsente, MigrationSuiviAbsente, SansFiche } from "./cadre";

const COLONNES = ["Formation", "Inscrits", "Progression moyenne", "Taux de complétion", "Note", "Statut", ""];
const chiffre = (n: number) => n.toLocaleString("fr-FR");
const pourcent = (n: number | null) => (n === null ? "—" : `${n} %`);
const note = (n: number | null) => (n === null ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/**
 * Tableau de bord du formateur (design NdFormateur ; spec « Étudiants » et tableau de bord, §4) : ses chiffres, ses
 * étudiants à risque, ses formations. Exercices, sessions live et questions arrivent aux lots 3 et 5.
 * La page vérifie le rôle avant (requireSpace).
 */
export async function TableauDeBordFormateur() {
  const cadre = { titre: "Espace formateur" };
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
  const lecture = await lireTableauDeBordFormateur();
  if (lecture.migrationAbsente) {
    return (
      <PageAdmin {...cadre}>
        <MigrationSuiviAbsente />
      </PageAdmin>
    );
  }
  const t = lecture.donnees;

  return (
    <PageAdmin {...cadre} description={`Bonjour ${t.prenom || "à vous"}. Voici ce qui demande votre attention aujourd’hui.`}>
      <div className="flex min-w-0 flex-col gap-5">
        <div className={GRILLE_CHIFFRES}>
          <Tuile icon={CourseIcon} label="Formations" value={chiffre(t.formations.total)} hint={`${t.formations.brouillons} en brouillon`} />
          <Tuile icon={UserMultipleIcon} label="Étudiants" value={chiffre(t.etudiants.total)} hint={`+${chiffre(t.etudiants.ceMois)} ce mois`} />
          <Tuile icon={Target02Icon} tone="reussite" label="Progression moyenne" value={pourcent(t.progressionMoyenne)} hint="Toutes formations" />
          <Tuile icon={Certificate01Icon} tone="attention" label="Certificats délivrés" value="—" hint="Disponible au lot 3" />
        </div>

        <div className={RANGEE}>
          <Carte titre="Exercices à corriger" lot={3} className="flex-[1_1_320px]">
            <div className={AVENIR}>Les exercices rendus par vos étudiants apparaîtront ici.</div>
          </Carte>
          <Carte titre="Étudiants à risque" className="flex-[1_1_320px]">
            <p className="m-0 text-[13px] leading-5 text-discret">Inactifs depuis plus de 10 jours.</p>
            {t.aRisque.length === 0 ? (
              <p className="m-0 text-sm leading-[22px] text-discret">Aucun étudiant à risque.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {t.aRisque.map((r) => {
                  const nom = nomAffiche(r.prenom, r.nom);
                  return (
                    <li key={`${r.etudiantId}-${r.formationTitre}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-bordure-carte py-3 first:border-t-0">
                      <Avatar initials={initialesCompte(r.prenom, r.nom, "?")} size={36} />
                      <span className="flex min-w-0 flex-[1_1_180px] flex-col">
                        <span className="text-sm leading-[22px] font-medium break-words text-encre">{nom}</span>
                        <span className="text-[13px] leading-5 break-words text-discret">{`${inactivite(r.jours)} · ${r.formationTitre} ${r.pourcentage} %`}</span>
                      </span>
                      <Link
                        href={`/formateur/etudiants/${r.etudiantId}`}
                        aria-label={`Voir le suivi de ${nom}`}
                        className="focus-etudium text-sm leading-5 font-medium whitespace-nowrap text-bleu no-underline hover:underline"
                      >
                        Voir le suivi
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Carte>
        </div>

        <div className={RANGEE}>
          <Carte titre="Prochaine session live" lot={5} className="flex-[1_1_320px]">
            <div className={AVENIR}>Vos sessions live et leurs inscrits apparaîtront ici.</div>
          </Carte>
          <Carte titre="Question récente" lot={5} className="flex-[1_1_320px]">
            <div className={AVENIR}>Les questions de vos étudiants apparaîtront ici.</div>
          </Carte>
        </div>

        <Carte titre="Mes formations">
          {t.formationsDetail.length === 0 ? (
            <p className="m-0 text-sm leading-[22px] text-discret">Vous n’avez pas encore de formation.</p>
          ) : (
            <TableauListe nom="Mes formations" nomCadre="Tableau de mes formations" colonnes={COLONNES.slice(0, 6)} actions largeurMin={820}>
              {t.formationsDetail.map((f) => (
                <tr key={f.id}>
                  <td className={`${CELLULE_TABLEAU} font-medium text-encre`}>{f.titre}</td>
                  <td className={CELLULE_TABLEAU}>{chiffre(f.inscrits)}</td>
                  <td className={CELLULE_TABLEAU}>{pourcent(f.progressionMoyenne)}</td>
                  <td className={CELLULE_TABLEAU}>{pourcent(f.completion)}</td>
                  <td className={CELLULE_TABLEAU}>{f.nbAvis > 0 ? note(f.noteMoyenne) : "—"}</td>
                  <td className={CELLULE_TABLEAU}>
                    <Tag tone={TON_ETAT[f.etat]}>{ETATS[f.etat]}</Tag>
                  </td>
                  <td className={`${CELLULE_TABLEAU} text-right`}>
                    <Link
                      href={`/formateur/formations/${f.id}`}
                      aria-label={`Modifier ${f.titre}`}
                      className="focus-etudium text-sm leading-5 font-medium whitespace-nowrap text-bleu no-underline hover:underline"
                    >
                      Modifier
                    </Link>
                  </td>
                </tr>
              ))}
            </TableauListe>
          )}
        </Carte>
      </div>
    </PageAdmin>
  );
}
