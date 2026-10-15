import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { RACINE_FORMATEUR } from "@/components/formateur/cadre";
import { Banner } from "@/components/ui/Banner";
import { buttonVariants } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { lireCorrections, lireRenduACorriger, MIGRATION_EXERCICES } from "@/lib/exercices/data";
import { CorrectionRendu } from "./CorrectionRendu";
import { ListeCorrections } from "./ListeCorrections";

type Espace = "formateur" | "admin";

const BASES = { formateur: "/formateur/corrections", admin: "/admin/corrections" } as const;
const RACINES = { formateur: RACINE_FORMATEUR, admin: { label: "Back-office", href: "/admin" } };

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
        <Banner tone="attention" title="Les exercices ne sont pas encore dans la base.">
          {MIGRATION_EXERCICES}
        </Banner>
      ) : (
        <ListeCorrections corrections={lecture.donnees} base={BASES[espace]} />
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
