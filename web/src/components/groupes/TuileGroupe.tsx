import { BookOpen01Icon, MessageMultiple02Icon, Route01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { CouleurGroupe, TypeGroupe } from "@/lib/groupes/types";

// La pastille d'un groupe, aux couleurs de son parcours (les étiquettes des parcours, planche « Étiquettes ») ; le
// Général en bleu Étudium.
const COULEURS: Record<NonNullable<CouleurGroupe> | "general", string> = {
  general: "bg-bleu text-white",
  academique: "bg-bleu-pale text-bleu",
  digital: "bg-premium-fond text-premium-texte",
  business: "bg-[#FFEDD9] text-business-texte",
};
const ICONES = { general: MessageMultiple02Icon, parcours: Route01Icon, formation: BookOpen01Icon } as const;

export function TuileGroupe({ type, couleur, className }: { type: TypeGroupe; couleur: CouleurGroupe; className?: string }) {
  const ton = type === "general" ? COULEURS.general : COULEURS[couleur ?? "academique"];
  return (
    <span aria-hidden="true" className={cn("flex size-12 flex-none items-center justify-center rounded-carte max-sm:size-11 max-sm:[&_svg]:size-5", ton, className)}>
      <Icon icon={ICONES[type]} size={22} />
    </span>
  );
}
