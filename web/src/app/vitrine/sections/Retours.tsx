import type { ReactNode } from "react";
import { FavouriteIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { CourseIllustration } from "@/components/ui/CourseIllustration";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { TaskProgress } from "@/components/ui/TaskProgress";
import { Panel, Section } from "../Section";
import { ToastsDemo, TooltipDemo } from "./RetoursDemo";

function Exemple({ legende, children }: { legende: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-stretch">
      {children}
      <span className="mt-2 text-xs leading-[18px] text-ardoise">{legende}</span>
    </div>
  );
}

export function Retours() {
  return (
    <Section
      id="retours"
      title="Messages, états vides et chargement"
      description="Un message dit ce qui s’est passé et, si besoin, ce qu’il faut faire ensuite."
    >
      <Panel title="Bandeaux dans la page">
        <div className="flex min-w-0 flex-col gap-3">
          <Banner tone="attention" title="Votre formule Standard expire dans 5 jours." action={<Button size="sm">Renouveler</Button>}>
            Renouvelez pour garder l’accès à vos formations. Rien ne sera supprimé.
          </Banner>
          <Banner
            tone="information"
            action={
              <a href="#" className="focus-etudium cible-tactile relative text-sm leading-[22px] font-medium text-bleu no-underline hover:underline">
                Voir ma formule
              </a>
            }
          >
            Formations complémentaires : <strong className="font-semibold">1 sur 2</strong> utilisées avec votre formule Standard.
          </Banner>
          <Banner tone="reussite" title="Exercice validé.">
            Dr Adjovi a validé votre tableau croisé dynamique. Le module 4 est débloqué.
          </Banner>
          <Banner
            tone="erreur"
            title="Le paiement n’a pas abouti."
            action={
              <Button variant="contour" size="sm">
                Réessayer
              </Button>
            }
          >
            Aucun montant n’a été débité. Vérifiez votre solde Mobile Money.
          </Banner>
        </div>
      </Panel>

      <Panel title="Notifications éphémères" coque>
        <ToastsDemo />
      </Panel>

      <Panel title="États vides">
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
          <EmptyState
            icon={FavouriteIcon}
            title="Aucun favori pour le moment"
            description="Touchez le cœur d’une formation pour la retrouver ici."
            action={<Button>Parcourir le catalogue</Button>}
          />
          <EmptyState
            icon={Search01Icon}
            title="Aucun résultat pour « zotéro »"
            description="Vérifiez l’orthographe ou essayez un mot plus général."
            action={<Button variant="contour">Effacer la recherche</Button>}
          />
          <EmptyState
            illustration={<CourseIllustration parcours="academique" size={64} />}
            title="Votre première formation vous attend"
            description="Commencez par une formation gratuite, sans engagement."
            action={<Button>Voir les formations gratuites</Button>}
          />
        </div>
      </Panel>

      <Panel title="Chargement et aides">
        <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <Exemple legende="Carte en cours de chargement">
            <SkeletonCard label="Chargement d’une formation…" />
          </Exemple>
          <Exemple legende="Indicateur d’attente">
            <Spinner size={24} label="Chargement de la leçon…" />
          </Exemple>
          <Exemple legende="Infobulle au survol (ou au focus clavier)">
            <div className="flex flex-col items-center gap-2 pt-[38px]">
              <TooltipDemo />
            </div>
          </Exemple>
          <Exemple legende="Progression d’une tâche">
            <TaskProgress label="Envoi du fichier…" value={62} />
          </Exemple>
        </div>
      </Panel>
    </Section>
  );
}
