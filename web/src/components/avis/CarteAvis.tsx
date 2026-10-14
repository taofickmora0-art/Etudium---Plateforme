import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { toneAvatar } from "@/lib/avis/regles";
import type { AvisPublic } from "@/lib/avis/types";
import { cn } from "@/lib/cn";
import { EtoilesNote } from "./EtoilesNote";

/**
 * Un avis (annexe 1.3 §5.4 publique, §6 c connectée) : avatar, nom, note, commentaire. La rangée d'étoiles s'ajoute à
 * la maquette : un avis peut n'avoir que sa note. Le sien porte « Votre avis », et jamais la mention d'un masquage :
 * son auteur ne doit pas savoir que l'équipe l'a masqué.
 */
export function CarteAvis({ avis, variante }: { avis: AvisPublic; variante: "public" | "connecte" }) {
  const publique = variante === "public";
  return (
    <li
      className={cn(
        "box-border flex min-w-0 flex-col",
        publique ? "rounded-[20px] bg-page p-[22px]" : "rounded-carte border border-bordure-carte bg-panneau px-[18px] pt-4 pb-[18px]",
      )}
    >
      <div className={cn("flex min-w-0 items-center", publique ? "gap-3" : "gap-2.5")}>
        <Avatar initials={avis.initiales} size={publique ? 40 : 36} tone={toneAvatar(avis.id)} />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("font-semibold text-encre wrap-anywhere", publique ? "text-[15px] leading-[22px]" : "text-sm leading-[22px]")}>{avis.auteur}</span>
            {avis.estMoi && <Tag tone="compteur">Votre avis</Tag>}
          </div>
          <EtoilesNote note={avis.note} label={`Note : ${avis.note} sur 5`} />
        </div>
      </div>
      {avis.commentaire && (
        <p className={cn("m-0 mt-3 text-pretty whitespace-pre-line text-texte wrap-anywhere", publique ? "text-[15px] leading-6" : "text-sm leading-[22px]")}>{avis.commentaire}</p>
      )}
    </li>
  );
}
