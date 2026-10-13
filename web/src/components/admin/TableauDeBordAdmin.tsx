import { useId, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDataTransferHorizontalIcon,
  CrownIcon,
  Target02Icon,
  UserAdd01Icon,
  UserMultipleIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { ProgressBar } from "@/components/ui/Progress";
import { StatCard } from "@/components/ui/StatCard";
import { Tag } from "@/components/ui/Tag";
import { croissance, type StatistiquesBackOffice } from "@/lib/admin/statistiques";

// Quatre chiffres clés par rangée au plus, puis trois, deux, un (tuiles de 200 px au moins).
const GRILLE_CHIFFRES = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(200px,calc((100%-60px)/4))),1fr))] gap-5";
const RANGEE = "flex flex-wrap items-stretch gap-5";

const pluriel = (n: number, mot: string) => `${n.toLocaleString("fr-FR")} ${n > 1 ? `${mot}s` : mot}`;
const chiffre = (n: number) => n.toLocaleString("fr-FR");

/** Un chiffre clé (planche « Cartes », indicateurs) ; `data-tuile` la repère dans les tests. */
function Tuile(props: Parameters<typeof StatCard>[0] & { children?: ReactNode }) {
  const { children, ...carte } = props;
  return (
    <div data-tuile="" className="flex min-w-0 flex-col">
      <StatCard {...carte} className="flex-1">
        {children}
      </StatCard>
    </div>
  );
}

/** Un bloc titré ; `lot` : ce qu'il montrera arrive avec ce lot. */
function Carte({ titre, lot, className, children }: { titre: string; lot?: number; className?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section
      data-tuile=""
      aria-labelledby={id}
      className={`box-border flex min-w-0 flex-col gap-3 rounded-carte border border-bordure-carte bg-panneau px-5 py-[18px] ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="m-0 text-base leading-6 font-semibold text-encre">
          {titre}
        </h2>
        {lot && <Tag tone="enAttente">{`Disponible au lot ${lot}`}</Tag>}
      </div>
      {children}
    </section>
  );
}

const AVENIR = "flex min-h-[92px] items-center justify-center rounded-champ border border-dashed border-bordure-champ px-4 text-center text-[13px] leading-5 text-discret";

/**
 * Tableau de bord du back-office : la vue globale de la plateforme (choisie par l'utilisateur le 13 octobre 2026).
 * Inscriptions, apprentissage, formations les plus suivies ; revenus et abonnés (lot 2) et sessions live (lot 5) ont
 * déjà leur place et s'afficheront avec leur lot.
 */
export function TableauDeBordAdmin({ stats }: { stats: StatistiquesBackOffice | null }) {
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
          <Carte titre="Formations achetées seules" lot={2}>
            <p className="m-0 text-[13px] leading-5 text-discret">Les formations complémentaires achetées hors abonnement.</p>
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
          <Tuile icon={Video01Icon} label="Sessions live à venir" value="—" hint="Disponible au lot 5" />
        </div>
      </div>
    </div>
  );
}
