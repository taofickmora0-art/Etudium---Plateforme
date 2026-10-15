import { ListeCochee, MOTIF_BLEU } from "@/components/catalogue/BlocsFiche";
import { cn } from "@/lib/cn";
import { FORMULES, PRIX_A_VENIR } from "@/lib/landing/textes";
import { EnTeteSection, SECTION_NUE } from "./BlocsLanding";

/**
 * Formules (NdLanding §9), cible de « Tarifs » : les trois formules et leur contenu, sans prix au lot 1 (Q10). La
 * phrase « Prix annoncés au lancement » prend la place (et la hauteur) du prix. « Voir le détail » arrive avec la page
 * Tarifs, au lot 2.
 */
export function SectionFormules() {
  return (
    <section id="formules" aria-labelledby="titre-formules" className={SECTION_NUE}>
      <EnTeteSection
        pastille="Formules"
        ton="blanc"
        titre="Un abonnement mensuel, sans prélèvement automatique"
        idTitre="titre-formules"
        chapeau="Vous renouvelez quand vous voulez. Vos formations et vos certificats restent sur votre compte."
        centre
      />
      <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(270px,calc((100%-40px)/3))),1fr))] gap-5 max-sm:mt-6 max-sm:gap-3">
        {FORMULES.map((formule) => {
          const enAvant = formule.recommandee;
          return (
            <div
              key={formule.nom}
              className={cn(
                "box-border flex min-w-0 flex-col rounded-bloc p-7 max-sm:p-5",
                enAvant ? cn(MOTIF_BLEU, "shadow-[0_24px_48px_rgba(11,24,201,0.26)]") : "border border-bordure-carte bg-panneau",
              )}
            >
              <div className="flex min-h-7 items-center justify-between gap-2">
                <h3 className={cn("m-0 text-xl leading-7 font-semibold", enAvant ? "text-white" : "text-encre")}>{formule.nom}</h3>
                {enAvant && (
                  <span className="inline-flex items-center rounded-full bg-panneau px-2.5 py-1 text-xs leading-[18px] font-semibold text-bleu">Recommandée</span>
                )}
              </div>
              <p className={cn("mt-1.5 mb-0 min-h-11 text-sm leading-[22px] max-sm:min-h-0", enAvant ? "text-bleu-pale" : "text-discret")}>{formule.description}</p>
              <div className="mt-[18px] flex min-h-12 items-center max-sm:mt-3 max-sm:min-h-0">
                <span className={cn("text-base leading-6 font-medium", enAvant ? "text-white" : "text-titre")}>{PRIX_A_VENIR}</span>
              </div>
              <div aria-hidden="true" className={cn("my-6 h-px max-sm:my-4", enAvant ? "bg-white/22" : "bg-bordure-carte")} />
              <div className="flex-1">
                <ListeCochee
                  elements={formule.points}
                  couleur={enAvant ? "text-white" : "text-bleu"}
                  couleurTexte={enAvant ? "text-white" : "text-texte"}
                  taille="text-sm"
                  colonnes="grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-2.5"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
