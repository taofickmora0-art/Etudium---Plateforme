import type { ReactNode } from "react";
import Link from "next/link";
import { CarteFormation } from "@/components/catalogue/CarteFormation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Heading, Lead } from "@/components/ui/Text";
import type { DonneesTableau } from "@/lib/tableau-de-bord/types";
import { ActiviteRecente, AFaire, Continuer, Indicateurs, ObjectifSemaine, Section } from "./Blocs";
import { ProchaineSessionBloc } from "./ProchaineSessionBloc";

// Le tableau de bord de l'étudiant (lot 6 B, §1 ; design NdAccueil). Il répond aux 4 questions du design system (§22) :
// où en suis-je (indicateurs), que dois-je continuer (Continuer), que dois-je faire maintenant (À faire, prochaine
// session, objectif), qu'est-ce que je peux apprendre ensuite (activité, recommandations).

const GRILLE_RECOMMANDATIONS = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(232px,calc((100%-40px)/3))),1fr))] gap-5";

export function TableauDeBord({ donnees: d, bandeau }: { donnees: DonneesTableau; bandeau?: ReactNode }) {
  const maintenant = new Date(d.maintenant);
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <Heading level="page">{d.prenom ? `Bonjour, ${d.prenom}` : "Bonjour"}</Heading>
          <Lead className="mt-2.5">Continuez votre apprentissage et atteignez vos objectifs.</Lead>
        </div>
        <Button variant="contour" asChild>
          <Link href="/formations">Explorer le catalogue</Link>
        </Button>
      </div>
      <div className="mt-5 h-px bg-separateur" />
      <div className="mt-8 flex min-w-0 flex-col gap-8 max-sm:mt-6 max-sm:gap-7">
        <div className="flex min-w-0 flex-col gap-5">
          {bandeau}
          {d.base === null && (
            <Banner tone="attention" title="Le tableau de bord n’est pas encore complet">
              Appliquez la migration 0063 (guide « Ce qui te revient », section 62).
            </Banner>
          )}
          <Indicateurs indicateurs={d.indicateurs} base={d.base} />
        </div>
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-8">
            <Continuer continuer={d.continuer} />
            <AFaire elements={d.aFaire} />
          </div>
          <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-8">
            {d.session !== undefined && (
              <Section titre="Prochaine session live" lien={{ href: "/evenements", texte: "Événements" }}>
                <div className="box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau px-[19px] pt-[22px] pb-[17px] max-sm:px-4 max-sm:pt-[18px]">
                  {d.session ? (
                    <ProchaineSessionBloc session={d.session} />
                  ) : (
                    <p className="m-0 text-sm leading-[22px] text-discret">Aucune session programmée pour l’instant.</p>
                  )}
                </div>
              </Section>
            )}
            {d.base && <ObjectifSemaine jeu={d.base.jeu} />}
          </div>
        </div>
        {d.base && <ActiviteRecente activite={d.base.activite} maintenant={maintenant} />}
        <Section titre="Recommandé pour vous" lien={d.recommandees.length > 0 ? { href: "/formations", texte: "Tout voir" } : undefined}>
          {d.messageSuite && <p className="m-0 -mt-2 text-sm leading-[22px] text-pretty text-discret">{d.messageSuite}</p>}
          {d.recommandees.length > 0 ? (
            <div className={GRILLE_RECOMMANDATIONS}>
              {d.recommandees.map((carte) => (
                <CarteFormation key={carte.id} carte={carte} variante="connecte" titleAs="h3" />
              ))}
            </div>
          ) : (
            <div className="box-border flex min-w-0 flex-col items-start gap-3 rounded-carte border border-bordure-carte bg-panneau px-[19px] py-5">
              <p className="m-0 text-sm leading-[22px] text-texte">
                {d.aucunePubliee ? "Aucune formation n’est encore publiée." : "Vous avez déjà commencé toutes les formations disponibles."}
              </p>
              <Button variant="contour" asChild>
                <Link href="/formations">Voir le catalogue</Link>
              </Button>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
