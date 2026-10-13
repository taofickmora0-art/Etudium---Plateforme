import Image from "next/image";
import { cn } from "@/lib/cn";
import { CourseIllustration, type Parcours } from "./CourseIllustration";

// Fond de la couverture par défaut : la teinte claire du parcours (mêmes teintes que les tuiles de parcours).
const FONDS: Record<Parcours, string> = {
  academique: "bg-bleu-pale",
  digital: "bg-premium-fond",
  business: "bg-[#FFEDD9]",
};

type CouvertureProps = {
  /** Adresse publique de l'image, ou null : couverture par défaut du parcours. */
  src: string | null;
  parcours: Parcours;
  /** Largeur affichée, pour que next/image envoie une image à la bonne taille (données mobiles). */
  sizes: string;
  priority?: boolean;
  className?: string;
};

/**
 * Image de couverture d'une formation, en 16:9 : l'image est cadrée sans déformation (le centre est gardé). Sans image,
 * la couverture par défaut aux couleurs du parcours, avec son illustration. Décorative : le titre suit toujours.
 */
export function Couverture({ src, parcours, sizes, priority = false, className }: CouvertureProps) {
  return (
    <div data-parcours={parcours} className={cn("relative aspect-video w-full overflow-hidden", !src && FONDS[parcours], className)}>
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <CourseIllustration parcours={parcours} size={64} />
        </span>
      )}
    </div>
  );
}
