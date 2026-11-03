import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AlarmClockIcon, ArrowRight01Icon, AssignmentsIcon, BookOpen01Icon, HourglassIcon } from "@hugeicons/core-free-icons";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { RACINE_FORMATEUR } from "@/components/formateur/cadre";
import { GRILLE_CHIFFRES, Tuile } from "@/components/tableau/Blocs";
import { Banner } from "@/components/ui/Banner";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { buttonVariants } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { chiffresCorrections } from "@/lib/admin/chiffres-pages";
import { lireCorrections, lireRenduACorriger, MIGRATION_EXERCICES } from "@/lib/exercices/data";
import type { CorrectionAFaire } from "@/lib/exercices/types";
import { CorrectionRendu } from "./CorrectionRendu";
import { ListeCorrections } from "./ListeCorrections";

type Espace = "formateur" | "admin";

const BASES = { formateur: "/formateur/corrections", admin: "/admin/corrections" } as const;
const RACINES = { formateur: RACINE_FORMATEUR, admin: { label: "Back-office", href: "/admin" } };

const jours = (n: number) => `${n} ${n > 1 ? "jours" : "jour"}`;

/** Les chiffres clés de l'équipe (demande du 2 novembre 2026 : le style de l'espace étudiant) ; l'espace formateur garde sa planche. */
async function ChiffresCorrections({ corrections }: { corrections: CorrectionAFaire[] }) {
  await connection(); // la date du jour, à chaque visite
  const c = chiffresCorrections(corrections, new Date());
  return (
    <div className={GRILLE_CHIFFRES}>
      <Tuile icon={AssignmentsIcon} tone="information" label="À corriger" value={c.aCorriger.toLocaleString("fr-FR")} />
      <Tuile icon={AlarmClockIcon} tone="attention" label="En attente depuis plus de 7 jours" value={c.enRetard.toLocaleString("fr-FR")} />
      <Tuile icon={BookOpen01Icon} label="Formations concernées" value={c.formations.toLocaleString("fr-FR")} />
      <Tuile icon={HourglassIcon} label="Plus ancien dépôt" value={c.plusAncienJours === null ? "—" : jours(c.plusAncienJours)} />
    </div>
  );
}

/**
 * La page « Corrections » (lot 3, spec §3) : les travaux en attente des formations du formateur, ou de toutes les
 * formations pour l'équipe. La page vérifie le rôle avant (requireSpace) ; la base revérifie.
 */
export async function PageCorrections({ espace }: { espace: Espace }) {
  const lecture = await lireCorrections();
  return (
    <PageAdmin
      titre="Corrections"
      description={espace === "admin" ? "Les travaux déposés dans toutes les formations, les plus anciens d’abord." : "Les travaux déposés par vos étudiants, les plus anciens d’abord."}
      racine={RACINES[espace]}
      fil={[{ label: "Corrections" }]}
    >
      {lecture.migrationAbsente ? (
        espace === "admin" ? (
          <Banner tone="attention" title="Les exercices ne sont pas encore dans la base.">
            {MIGRATION_EXERCICES}
          </Banner>
        ) : (
          <BandeauIndisponible />
        )
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          {espace === "admin" && <ChiffresCorrections corrections={lecture.donnees} />}
          <ListeCorrections corrections={lecture.donnees} base={BASES[espace]} />
        </div>
      )}
    </PageAdmin>
  );
}

/** La correction d'un travail (NdCorrection) ; introuvable sans droit (la base ne livre le travail qu'à ses correcteurs). */
export async function PageCorrection({ espace, renduId }: { espace: Espace; renduId: string }) {
  const rendu = await lireRenduACorriger(renduId);
  if (!rendu) notFound();
  const base = BASES[espace];
  return (
    <PageAdmin
      titre="Correction d’un exercice"
      description={`${rendu.exercice.titre} · ${rendu.formation.titre}, module ${rendu.module.rang}.`}
      racine={RACINES[espace]}
      fil={[{ label: "Corrections", href: base }, { label: rendu.etudiant }]}
      action={
        rendu.suivant ? (
          <Link href={`${base}/${rendu.suivant}`} className={buttonVariants({ variant: "contour" })}>
            <span>Exercice suivant</span>
            <Icon icon={ArrowRight01Icon} size={18} />
          </Link>
        ) : undefined
      }
    >
      <CorrectionRendu key={rendu.version.id} rendu={rendu} />
    </PageAdmin>
  );
}
