import Link from "next/link";
import { CourseIcon, GiftIcon, Target02Icon } from "@hugeicons/core-free-icons";
import { CarteFormation } from "@/components/catalogue/CarteFormation";
import { CarteProchaineSession } from "@/components/sessions/CarteProchaineSession";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { GRILLE_CARTES, GRILLE_DEUX } from "@/components/ui/grilles";
import { Groupe } from "@/components/ui/Groupe";
import { StatCard } from "@/components/ui/StatCard";
import type { TableauDeBord as Donnees } from "@/lib/accueil/regles";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import type { ProchaineSession } from "@/lib/sessions/types";
import { CarteReprise } from "./CarteReprise";
import { ListeAFaire } from "./ListeAFaire";

function Cartes({ cartes }: { cartes: CarteCatalogue[] }) {
  return (
    <div className={GRILLE_CARTES}>
      {cartes.map((carte) => (
        <CarteFormation key={carte.id} carte={carte} variante="connecte" titleAs="h3" />
      ))}
    </div>
  );
}

/**
 * Tableau de bord, version de base (spec du lot 1, §8 ; NdAccueil, NdMobAccueil) : la zone sous l'en-tête. Seuls les
 * blocs qui ont de vraies données au lot 1 ; un compte qui n'a rien commencé est orienté vers les formations gratuites.
 */
/** La carte « Prochaine session live » (NdAccueil) : la plus proche des inscriptions, sinon la prochaine session. */
function ProchaineSessionLive({ session }: { session: ProchaineSession }) {
  return (
    <Groupe titre="Prochaine session live" lien={{ href: "/evenements", libelle: "Événements" }}>
      <CarteProchaineSession session={session} />
    </Groupe>
  );
}

export function TableauDeBord({ donnees, session = null }: { donnees: Donnees; session?: ProchaineSession | null }) {
  const { commencees, enCours, progressionGlobale, reprise, aFaire, recommandees, gratuites } = donnees;

  if (commencees === 0) {
    return (
      <div className="flex min-w-0 flex-col gap-8 max-sm:gap-6">
        <EmptyState
          icon={GiftIcon}
          title="Commencez votre première formation"
          description="Les formations gratuites sont ouvertes à tous : choisissez-en une et suivez la première leçon."
          action={
            <Button asChild>
              <Link href="/formations-gratuites">Voir les formations gratuites</Link>
            </Button>
          }
        />
        {session && <ProchaineSessionLive session={session} />}
        {gratuites.length > 0 && (
          <Groupe titre="Formations gratuites" lien={{ href: "/formations-gratuites", libelle: "Tout voir" }}>
            <Cartes cartes={gratuites} />
          </Groupe>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-8 max-sm:gap-6">
      {/* Sur téléphone, NdMobAccueil n'a pas de tuiles. */}
      <div className={cn(GRILLE_DEUX, "max-sm:hidden")}>
        <StatCard icon={Target02Icon} label="Progression globale" value={`${progressionGlobale} %`} hint="Moyenne de vos formations commencées" />
        <StatCard
          icon={CourseIcon}
          tone="information"
          label="Formations en cours"
          value={String(enCours)}
          hint={commencees > 1 ? `Sur ${commencees} formations commencées` : "Sur 1 formation commencée"}
        />
      </div>
      {reprise && (
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-[999_1_420px]">
            <Groupe titre="Continuer l’apprentissage" lien={{ href: "/mes-formations", libelle: "Mes formations" }}>
              <CarteReprise reprise={reprise} />
            </Groupe>
          </div>
          {(aFaire.length > 0 || session) && (
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-8 max-sm:gap-6">
              {aFaire.length > 0 && (
                <Groupe titre="À faire" etiquette={aFaire.length > 1 ? `${aFaire.length} éléments` : "1 élément"}>
                  <ListeAFaire elements={aFaire} />
                </Groupe>
              )}
              {/* NdAccueil : la prochaine session live, sous « À faire ». */}
              {session && <ProchaineSessionLive session={session} />}
            </div>
          )}
        </div>
      )}
      {!reprise && session && <ProchaineSessionLive session={session} />}
      {recommandees.length > 0 && (
        <Groupe titre="Recommandé pour vous" lien={{ href: "/formations", libelle: "Tout voir" }}>
          <Cartes cartes={recommandees} />
        </Groupe>
      )}
    </div>
  );
}
