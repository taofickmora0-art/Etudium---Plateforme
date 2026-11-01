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
import { Carte, GRILLE_CHIFFRES, RANGEE, Tuile } from "@/components/tableau/Blocs";
import { croissance, type StatistiquesBackOffice } from "@/lib/admin/statistiques";
import { montantFcfa } from "@/lib/abonnement/regles";

const pluriel = (n: number, mot: string) => `${n.toLocaleString("fr-FR")} ${n > 1 ? `${mot}s` : mot}`;
const chiffre = (n: number) => n.toLocaleString("fr-FR");
const MOIS_COURT = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const MOIS_LONG = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
/** « 2026-11 » : « nov. », et « novembre 2026 » pour les lecteurs d'écran. */
const mois = (cle: string, format: Intl.DateTimeFormat) => format.format(new Date(`${cle}-15T12:00:00Z`));

/** Le chiffre d'affaires mois par mois : six barres, hauteur relative au meilleur mois. */
function BarresMois({ parMois }: { parMois: StatistiquesBackOffice["caParMois"] }) {
  const max = Math.max(1, ...parMois.map((m) => m.montant));
  return (
    <div className="mt-1 flex h-[120px] items-end gap-2">
      {parMois.map((m) => (
        <div key={m.mois} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <div
            role="img"
            aria-label={`${mois(m.mois, MOIS_LONG)} : ${montantFcfa(m.montant)}`}
            className="w-full max-w-10 rounded-t-[6px] bg-bleu"
            style={{ height: `${Math.max(2, Math.round((90 * m.montant) / max))}px` }}
          />
          <span aria-hidden="true" className="text-xs leading-[18px] text-discret">
            {mois(m.mois, MOIS_COURT)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Tableau de bord du back-office : la vue globale de la plateforme (choisie par l'utilisateur le 13 octobre 2026).
 * Inscriptions, abonnés et revenus (lot 2, 0051), apprentissage, formations les plus suivies, sessions live à venir
 * (0018), contenus à examiner (0020).
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
        <Tuile icon={CrownIcon} tone="attention" label="Utilisateurs payants" value={chiffre(stats.abonnesActifs)} hint="abonnements actifs" />
        <Tuile
          icon={ArrowDataTransferHorizontalIcon}
          tone="reussite"
          label="Taux de conversion"
          value={stats.etudiants > 0 ? `${Math.round((100 * stats.abonnesActifs) / stats.etudiants)} %` : "—"}
          hint="des étudiants ont un abonnement actif"
        />
      </div>

      <div className={RANGEE}>
        <Carte titre="Chiffre d’affaires" className="flex-[2_1_420px]">
          <dl className="m-0 flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt className="text-[13px] leading-5 text-discret">Ce mois</dt>
              <dd className="m-0 text-2xl leading-8 font-medium text-titre">{montantFcfa(stats.caMois)}</dd>
            </div>
            <div>
              <dt className="text-[13px] leading-5 text-discret">Au total</dt>
              <dd className="m-0 text-2xl leading-8 font-medium text-titre">{montantFcfa(stats.caTotal)}</dd>
            </div>
          </dl>
          {stats.caParMois.length > 0 && <BarresMois parMois={stats.caParMois} />}
        </Carte>
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-5">
          <Carte titre="Revenus par formule">
            {stats.revenusParFormule.length === 0 ? (
              <p className="m-0 text-[13px] leading-5 text-discret">Aucun paiement pour le moment.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {stats.revenusParFormule.map((f) => (
                  <li key={f.code} className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm leading-[22px]">
                      <span className="font-medium text-encre">{f.nom}</span>
                      <span className="text-discret">{`${montantFcfa(f.montant)} · ${pluriel(f.nombre, "abonnement")}`}</span>
                    </div>
                    <ProgressBar value={stats.caTotal > 0 ? Math.round((100 * f.montant) / stats.caTotal) : 0} label={`Part de ${f.nom}`} />
                  </li>
                ))}
              </ul>
            )}
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
