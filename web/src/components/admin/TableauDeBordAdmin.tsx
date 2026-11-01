import Link from "next/link";
import {
  ArrowDataTransferHorizontalIcon,
  CrownIcon,
  Shield01Icon,
  Target02Icon,
  UserAdd01Icon,
  UserMultipleIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { ProgressBar } from "@/components/ui/Progress";
import { AVENIR, Carte, GRILLE_CHIFFRES, RANGEE, Tuile } from "@/components/tableau/Blocs";
import { croissance, type StatistiquesBackOffice } from "@/lib/admin/statistiques";

const pluriel = (n: number, mot: string) => `${n.toLocaleString("fr-FR")} ${n > 1 ? `${mot}s` : mot}`;
const chiffre = (n: number) => n.toLocaleString("fr-FR");

/**
 * Tableau de bord du back-office : la vue globale de la plateforme (choisie par l'utilisateur le 13 octobre 2026).
 * Inscriptions, apprentissage, formations les plus suivies, sessions live à venir (0018) ; revenus et abonnés (lot 2)
 * ont déjà leur place et s'afficheront avec leur lot.
 */
export function TableauDeBordAdmin({
  stats,
  sessionsAVenir = null,
  aExaminer = null,
}: {
  stats: StatistiquesBackOffice | null;
  sessionsAVenir?: number | null;
  /** Les contenus de la file de modération (migration 0020) ; null avant. */
  aExaminer?: number | null;
}) {
  if (!stats) {
    return (
      <Banner tone="attention" title="Les statistiques ne sont pas encore dans la base.">
        Appliquez la migration 0011 (guide « Ce qui te revient », section 16).
      </Banner>
    );
  }
  const evolution = croissance(stats);
  const plusSuivie = Math.max(1, ...stats.formationsSuivies.map((f) => f.etudiants));

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className={GRILLE_CHIFFRES}>
        <Tuile
          icon={UserMultipleIcon}
          tone="information"
          label="Utilisateurs inscrits"
          value={chiffre(stats.utilisateurs)}
          hint={evolution === null ? undefined : `${evolution >= 0 ? "+" : "−"}${Math.abs(evolution)} % ce mois`}
        />
        <Tuile
          icon={UserAdd01Icon}
          label="Nouveaux inscrits"
          value={chiffre(stats.inscritsSemaine)}
          hint={`cette semaine · ${chiffre(stats.inscritsMois)} ce mois (${chiffre(stats.inscritsMoisPrecedent)} le mois dernier)`}
        />
        <Tuile icon={CrownIcon} tone="attention" label="Utilisateurs payants" value="—" hint="Disponible au lot 2" />
        <Tuile icon={ArrowDataTransferHorizontalIcon} tone="reussite" label="Taux de conversion" value="—" hint="Disponible au lot 2" />
      </div>

      <div className={RANGEE}>
        <Carte titre="Chiffre d’affaires" lot={2} className="flex-[2_1_420px]">
          <p className="m-0 text-[13px] leading-5 text-discret">Ce mois, au total, et sa courbe mois par mois.</p>
          <div className={AVENIR}>La courbe apparaîtra avec les premiers paiements.</div>
        </Carte>
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-5">
          <Carte titre="Revenus par formule" lot={2}>
            <p className="m-0 text-[13px] leading-5 text-discret">Basique, Standard et Premium.</p>
          </Carte>
        </div>
      </div>

      <div className={RANGEE}>
        <Carte titre="Formations les plus suivies" className="flex-[2_1_420px]">
          {stats.formationsSuivies.length === 0 ? (
            <p className="m-0 text-sm leading-[22px] text-discret">Aucune formation commencée pour le moment.</p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {stats.formationsSuivies.map((f) => (
                <li key={f.slug} className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm leading-[22px]">
                    <Link href={`/formations/${f.slug}`} className="focus-etudium min-w-0 font-medium text-encre no-underline wrap-anywhere hover:underline">
                      {f.titre}
                    </Link>
                    <span className="flex-none text-discret">{pluriel(f.etudiants, "étudiant")}</span>
                  </div>
                  <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-piste">
                    <div className="h-full rounded-full bg-bleu" style={{ width: `${Math.round((100 * f.etudiants) / plusSuivie)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Carte>
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-5">
          <Tuile
            icon={Target02Icon}
            label="Progression moyenne"
            value={stats.progressionMoyenne === null ? "—" : `${stats.progressionMoyenne} %`}
            hint="des formations commencées"
          >
            {stats.progressionMoyenne !== null && <ProgressBar value={stats.progressionMoyenne} label="Progression moyenne" className="mt-2.5" />}
          </Tuile>
          {/* Sessions live (migration 0018) : leur nombre ; avant, la tuile garde sa place. */}
          <Tuile
            icon={Video01Icon}
            label="Sessions live à venir"
            value={sessionsAVenir === null ? "—" : chiffre(sessionsAVenir)}
            hint={sessionsAVenir === null ? "Disponible au lot 5" : "Programmées"}
          />
          {/* La file de modération (migration 0020) : son nombre et son lien ; avant, la tuile garde sa place. */}
          <Tuile
            icon={Shield01Icon}
            tone="attention"
            label="Contenus à examiner"
            value={aExaminer === null ? "—" : chiffre(aExaminer)}
            hint={aExaminer === null ? "Disponible au lot 5" : "Signalés par l’analyse ou par les membres"}
          >
            {aExaminer !== null && (
              <Link href="/admin/moderation" className="focus-etudium mt-2 text-sm leading-[22px] font-medium text-bleu no-underline hover:underline">
                Ouvrir la file
              </Link>
            )}
          </Tuile>
        </div>
      </div>
    </div>
  );
}
