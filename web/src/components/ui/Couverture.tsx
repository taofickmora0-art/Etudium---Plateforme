import Image from "next/image";
import { Book02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { CourseIllustration, type Parcours } from "./CourseIllustration";
import { Icon } from "./Icon";

// Fond de la couverture par défaut : la teinte claire du parcours (mêmes teintes que les tuiles de parcours).
const FONDS: Record<Parcours, string> = {
  academique: "bg-bleu-pale",
  digital: "bg-premium-fond",
  business: "bg-[#FFEDD9]",
};

// Le livre sans couverture : l'icône d'un livre, dans la couleur foncée du parcours.
const ENCRES: Record<Parcours, string> = { academique: "text-bleu", digital: "text-premium-texte", business: "text-business-texte" };

type CouvertureProps = {
  /** Adresse publique de l'image, ou null : couverture par défaut du parcours. */
  src: string | null;
  parcours: Parcours;
  /** Largeur affichée, pour que next/image envoie une image à la bonne taille (données mobiles). */
  sizes: string;
  /** Image en haut de page : chargée en priorité (fetchPriority, recommandé par Next 16 à la place de priority). */
  prioritaire?: boolean;
  /**
   * « livre » (Bibliothèque) : la couverture, en portrait, est montrée entière au centre du cadre 16:9, sur la teinte du
   * parcours ; sans image, l'icône d'un livre. Par défaut, l'image d'une formation remplit le cadre.
   */
  format?: "formation" | "livre";
  className?: string;
};

/**
 * Image de couverture d'une formation, en 16:9 : l'image est cadrée sans déformation (le centre est gardé). Sans image,
 * la couverture par défaut aux couleurs du parcours, avec son illustration. Décorative : le titre suit toujours.
 */
export function Couverture({ src, parcours, sizes, prioritaire = false, format = "formation", className }: CouvertureProps) {
  const livre = format === "livre";
  return (
    <div
      data-parcours={parcours}
      data-format={livre ? "livre" : undefined}
      className={cn("relative aspect-video w-full overflow-hidden", (!src || livre) && FONDS[parcours], className)}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          fetchPriority={prioritaire ? "high" : undefined}
          className={livre ? "object-contain py-3 drop-shadow-md" : "object-cover"}
        />
      ) : livre ? (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <Icon icon={Book02Icon} size={56} className={ENCRES[parcours]} />
        </span>
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <CourseIllustration parcours={parcours} size={64} />
        </span>
      )}
    </div>
  );
}
