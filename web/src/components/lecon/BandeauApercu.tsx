import { ViewIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";

/**
 * Ce que l'équipe ou le formateur regarde en aperçu (refonte des formations, spec §3.5) ; « formateur » : le formateur
 * sur une leçon de sa formation publiée (restructuration R1 : il n'est plus étudiant).
 */
export type Apercu = "formation" | "lecon" | "formateur";

/**
 * « Aperçu : pas encore visible des étudiants » : l'équipe ou le formateur regarde une formation non publiée, ou une
 * leçon en brouillon. Rien n'y est enregistré (ni visite, ni temps regardé, ni leçon terminée).
 */
export function BandeauApercu({ apercu }: { apercu: Apercu }) {
  return (
    <div role="status" aria-label={apercu === "formateur" ? "Aperçu de votre leçon" : "Aperçu : pas encore visible des étudiants"} className="flex items-start gap-3 rounded-carte border border-attention-texte/30 bg-attention-fond px-4 py-3 text-attention-texte">
      <Icon icon={ViewIcon} size={20} className="mt-0.5 flex-none" />
      {apercu === "formateur" ? (
        <span className="min-w-0 text-sm leading-5">Aperçu de votre leçon, telle que la voit un étudiant : votre progression n’est pas enregistrée.</span>
      ) : (
      <span className="flex min-w-0 flex-col text-sm leading-5">
        <span className="font-semibold">Aperçu : pas encore visible des étudiants</span>
        <span>{apercu === "formation" ? "Cette formation n’est pas encore publiée." : "Cette leçon est en brouillon."}</span>
        <span>Votre progression n’y est pas enregistrée.</span>
      </span>
      )}
    </div>
  );
}
