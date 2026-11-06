import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { CarteFormation } from "@/components/catalogue/CarteFormation";
import { CARTE_FICHE, EnTeteFiche, TitreSection } from "@/components/catalogue/StructureFiche";
import { GRILLE_CATALOGUE_CONNECTEE, GRILLE_CATALOGUE_PUBLIQUE } from "@/components/ui/grilles";
import { Icon } from "@/components/ui/Icon";
import { Heading } from "@/components/ui/Text";
import { etatDeCarte } from "@/lib/catalogue/regles";
import type { EtatsCartes } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import { arriveeDuFormateur } from "@/lib/formateurs/regles";
import type { FormateurPublic } from "@/lib/formateurs/types";
import { AvatarFormateur } from "./AvatarFormateur";
import { BoutonMessageFormateur } from "./BoutonMessageFormateur";
import { ReseauxFormateur } from "./ReseauxFormateur";
import { TagFormateur } from "./TagFormateur";

type Props = {
  formateur: FormateurPublic;
  /** « Message » : le compte connecté peut lui écrire. Jamais pour un visiteur ni pour un compte formateur. */
  peutEcrire: boolean;
  /** Les colonnes du catalogue : celles du visiteur (cadre public) ou du compte connecté (coque de l'appli). */
  variante: "public" | "connecte";
  /** Apprenants, inscription et favoris des cartes, comme dans le catalogue (spec du 2 novembre 2026, §4). */
  etats: EtatsCartes;
  /** L'heure de la visite (« A rejoint : il y a … »). */
  maintenant: Date;
};

/** L'en-tête : photo ou initiales, nom, « Formateur », titre (ou domaine), arrivée, « Message », présentation et réseaux. */
function EnTeteProfil({ formateur, peutEcrire, maintenant }: Pick<Props, "formateur" | "peutEcrire" | "maintenant">) {
  const arrivee = arriveeDuFormateur(formateur.rejointLe, maintenant);
  const sousTitre = formateur.titre || formateur.domaine;
  return (
    <section aria-label={`Profil de ${formateur.nom}`} className={cn(CARTE_FICHE, "p-6 max-sm:p-4")}>
      <div className="flex flex-wrap items-start gap-x-5 gap-y-4 max-sm:gap-x-3.5">
        <AvatarFormateur nom={formateur.nom} photoUrl={formateur.photoUrl} taille={64} className="max-sm:size-14 max-sm:text-xl" />
        <div className="flex min-w-0 flex-[1_1_220px] flex-col items-start gap-2 max-sm:flex-[1_1_160px] max-sm:gap-1.5">
          <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <Heading level="page" className="min-w-0 wrap-anywhere">
              {formateur.nom}
            </Heading>
            <TagFormateur id={formateur.id} />
          </div>
          {sousTitre && <p className="m-0 text-[15px] leading-[22px] font-medium text-pretty text-texte max-sm:text-sm max-sm:leading-5">{sousTitre}</p>}
          {arrivee && (
            <p className="m-0 flex items-center gap-1.5 text-[13px] leading-5 text-discret max-sm:text-xs max-sm:leading-[18px]">
              <Icon icon={Calendar03Icon} size={16} className="flex-none max-sm:size-[14px]" />
              <span>{arrivee}</span>
            </p>
          )}
        </div>
        {peutEcrire && <BoutonMessageFormateur formateurId={formateur.id} className="flex-none max-sm:w-full max-sm:[&>button]:w-full" />}
      </div>
      {formateur.presentation && (
        <p className="m-0 mt-5 max-w-[72ch] text-[15px] leading-6 text-pretty whitespace-pre-line text-texte max-sm:mt-4 max-sm:text-sm max-sm:leading-[22px]">
          {formateur.presentation}
        </p>
      )}
      <ReseauxFormateur nom={formateur.nom} reseaux={formateur.reseaux} className="mt-5 max-sm:mt-4" />
    </section>
  );
}

/**
 * Le profil public d'un formateur (spec du 2 novembre 2026, §6) : le fil « Formations › Nom », l'en-tête dans une carte
 * blanche, puis « Ses formations (N) » en cartes du catalogue, avec ses colonnes. Pour un visiteur, le tout tient dans le
 * grand bloc blanc des pages publiques (comme la fiche d'une formation).
 */
export function ProfilFormateur({ formateur, peutEcrire, variante, etats, maintenant }: Props) {
  const nb = formateur.formations.length;
  const contenu = (
    <div className="flex min-w-0 flex-col">
      <EnTeteFiche fiche={{ titre: formateur.nom }} />
      <div aria-hidden="true" className="mt-4 h-px bg-[#DBE0EB] max-sm:mt-3.5" />
      <div className="mt-6 max-sm:mt-5">
        <EnTeteProfil formateur={formateur} peutEcrire={peutEcrire} maintenant={maintenant} />
      </div>
      <section aria-labelledby="formations-du-formateur" className="mt-9 flex min-w-0 flex-col gap-5 max-sm:mt-7 max-sm:gap-4">
        <TitreSection id="formations-du-formateur">{nb > 0 ? `Ses formations (${nb})` : "Ses formations"}</TitreSection>
        {nb === 0 ? (
          <p className="m-0 text-[15px] leading-[22px] text-pretty text-discret max-sm:text-sm max-sm:leading-5">{`${formateur.nom} n’a pas encore de formation publiée.`}</p>
        ) : (
          <div className={variante === "connecte" ? GRILLE_CATALOGUE_CONNECTEE : GRILLE_CATALOGUE_PUBLIQUE}>
            {formateur.formations.map((formation) => (
              <CarteFormation key={formation.id} carte={formation} titleAs="h3" {...etatDeCarte(etats, formation.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
  if (variante === "connecte") return contenu;
  return <div className="box-border rounded-panneau bg-panneau p-[clamp(20px,4vw,40px)] max-sm:p-4">{contenu}</div>;
}
