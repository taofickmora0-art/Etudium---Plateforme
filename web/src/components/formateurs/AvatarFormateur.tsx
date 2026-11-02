import { initialesDe } from "@/components/catalogue/BlocsFiche";
import { Avatar } from "@/components/ui/Avatar";

type Taille = 40 | 44 | 48 | 52 | 56 | 64;

/**
 * L'avatar d'un formateur (fiche d'une formation, carte au survol, profil) : la photo de son compte, sinon ses initiales,
 * sans les titres (« Dr Mireille Adjovi » → « MA »). Violet, comme les formateurs de la messagerie.
 */
export function AvatarFormateur({ nom, photoUrl, taille = 48, className }: { nom: string; photoUrl: string | null; taille?: Taille; className?: string }) {
  return <Avatar initials={initialesDe(nom)} src={photoUrl} size={taille} tone="violet" className={className} />;
}
