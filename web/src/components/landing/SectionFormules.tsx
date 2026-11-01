import Link from "next/link";
import { ListeCochee, MOTIF_BLEU } from "@/components/catalogue/BlocsFiche";
import { Button } from "@/components/ui/Button";
import { dureeAbonnement, montantFcfa } from "@/lib/abonnement/regles";
import type { Formule } from "@/lib/abonnement/types";
import { cn } from "@/lib/cn";
import { FORMULES, PRIX_A_VENIR } from "@/lib/landing/textes";
import { EnTeteSection, SECTION_NUE } from "./BlocsLanding";

/** « Choisir » : le visiteur crée son compte, puis arrive sur la souscription de cet abonnement. */
const choisir = (code: string) => `/inscription?next=${encodeURIComponent(`/abonnement/souscrire?formule=${code}`)}`;

/**
 * Formules (NdLanding §9), cible de « Tarifs » : les trois abonnements, leur contenu et leur prix fixé au back-office
 * (lot 2). Sans prix fixé (ou sans lecture possible), « Prix annoncés au lancement » prend la place (et la hauteur) du
 * prix. Une formule désactivée par l'équipe n'est pas proposée.
 */
export function SectionFormules({ formules }: { formules: Formule[] }) {
  return (
    <section id="formules" aria-labelledby="titre-formules" className={SECTION_NUE}>
      <EnTeteSection
        pastille="Formules"
        ton="blanc"
        titre="Un abonnement de 3 mois à 1 an, sans prélèvement automatique"
        idTitre="titre-formules"
        chapeau="Vous renouvelez quand vous voulez. Vos formations et vos certificats restent sur votre compte."
        centre
      />
      <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(270px,calc((100%-40px)/3))),1fr))] gap-5 max-sm:mt-6 max-sm:gap-3">
        {FORMULES.map((formule) => {
          const code = formule.nom.toLowerCase();
          const enBase = formules.find((f) => f.code === code);
          if (enBase && !enBase.active) return null;
          const enAvant = formule.recommandee;
          const prix = enBase?.prix ?? null;
          return (
            <div
              key={formule.nom}
              data-formule={code}
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
                {prix === null ? (
                  <span className={cn("text-base leading-6 font-medium", enAvant ? "text-white" : "text-titre")}>{PRIX_A_VENIR}</span>
                ) : (
                  <p className="m-0 flex flex-wrap items-baseline gap-x-2">
                    <span
                      className={cn(
                        "text-[44px] leading-[48px] font-medium tracking-[-0.03em] max-sm:text-[34px] max-sm:leading-10",
                        enAvant ? "text-white" : "text-titre",
                      )}
                    >
                      {montantFcfa(prix)}
                    </span>
                    <span className={cn("text-sm leading-[22px]", enAvant ? "text-bleu-pale" : "text-discret")}>{`pour ${dureeAbonnement(enBase?.dureeMois ?? 3)}`}</span>
                  </p>
                )}
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
              <Button
                asChild
                size="lg"
                variant="contour"
                className={cn("mt-7 w-full max-sm:mt-5", enAvant && "border-0 bg-panneau font-semibold text-bleu [a&]:hover:bg-bleu-pale")}
              >
                <Link href={choisir(code)}>{`Choisir ${formule.nom}`}</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
