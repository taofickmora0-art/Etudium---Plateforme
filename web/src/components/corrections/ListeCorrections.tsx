import Link from "next/link";
import { AssignmentsIcon } from "@hugeicons/core-free-icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tag } from "@/components/ui/Tag";
import { moment } from "@/lib/communaute/regles";
import type { CorrectionAFaire } from "@/lib/exercices/types";

/**
 * Les travaux à corriger (NdFormateur, « Corrections »), les plus anciens d'abord : l'étudiant, l'exercice, la formation
 * et le module, la version et quand elle a été déposée. Chaque ligne mène à la correction.
 */
export function ListeCorrections({ corrections, base }: { corrections: CorrectionAFaire[]; base: "/formateur/corrections" | "/admin/corrections" }) {
  if (corrections.length === 0) {
    return <EmptyState icon={AssignmentsIcon} title="Aucun travail à corriger" description="Les travaux déposés par les étudiants s’afficheront ici, les plus anciens d’abord." />;
  }
  const maintenant = new Date();
  return (
    <ul aria-label="Travaux à corriger" className="m-0 flex max-w-[960px] list-none flex-col overflow-hidden rounded-carte border border-bordure-carte bg-panneau p-0">
      {corrections.map((c) => (
        <li key={c.renduId} className="border-t border-bordure-carte first:border-t-0">
          <Link
            href={`${base}/${c.renduId}`}
            className="focus-etudium flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-inherit no-underline transition-colors hover:bg-page max-sm:px-3.5 max-sm:py-3"
          >
            <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
              <span className="text-[15px] leading-[22px] font-semibold text-encre max-sm:text-sm">{c.etudiant}</span>
              <span className="text-[13px] leading-5 text-discret">{`${c.exercice} · ${c.formation}, module ${c.moduleRang}`}</span>
            </span>
            <span className="flex flex-none items-center gap-2.5">
              <span className="text-[13px] leading-5 text-discret">{`Version ${c.version} · ${moment(c.deposeLe, maintenant)}`}</span>
              <Tag tone="enAttente">En attente</Tag>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
