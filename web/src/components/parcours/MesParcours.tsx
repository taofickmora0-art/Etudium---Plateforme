import Link from "next/link";
import { ArrowRight01Icon, Route01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { MetaDot, ProgressBar } from "@/components/ui/Progress";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Tag } from "@/components/ui/Tag";
import { Heading, Lead } from "@/components/ui/Text";
import type { CarteCatalogue, ParcoursCatalogue } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import type { CouleurParcours } from "@/lib/contenus/libelles";
import { etatFormation, formationsDuParcours, progressionDuParcours, type ProgressionFormation } from "@/lib/parcours/regles";

type Props = { parcours: ParcoursCatalogue[]; cartes: CarteCatalogue[]; progressions: Map<string, ProgressionFormation> };

/** Tuile de 48 px aux couleurs du parcours (NdParcours). */
const TUILE: Record<CouleurParcours, string> = {
  academique: "bg-bleu-pale text-bleu",
  digital: "bg-premium-fond text-premium-texte",
  business: "bg-[#FFEDD9] text-business-texte",
};

const pluriel = (n: number, mot: string) => `${n} ${n > 1 ? `${mot}s` : mot}`;
const formationsTerminees = (terminees: number, total: number) =>
  terminees === 0 ? `Aucune formation terminée sur ${total}` : `${pluriel(terminees, "formation")} ${terminees > 1 ? "terminées" : "terminée"} sur ${total}`;

function LigneFormation({ carte, rang, progression }: { carte: CarteCatalogue; rang: number; progression?: ProgressionFormation }) {
  const etat = etatFormation(carte, progression);
  return (
    <li>
      <Link href={`/formations/${carte.slug}`} className="focus-etudium flex min-h-12 items-center gap-3.5 px-1 py-3.5 text-inherit no-underline transition-colors hover:bg-page">
        <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-champ bg-coque text-sm font-semibold text-texte">
          {String(rang).padStart(2, "0")}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] leading-[22px] font-medium text-encre">{carte.titre}</span>
        </span>
        {/* La barre laisse sa place au titre sur téléphone. */}
        <span className="w-[120px] flex-none max-sm:hidden">
          <ProgressBar value={progression?.pourcentage ?? 0} label={`Progression : ${carte.titre}`} className="h-1.5" />
        </span>
        <span className="flex w-[100px] flex-none justify-end">
          <Tag tone={etat.ton}>{etat.libelle}</Tag>
        </span>
        <span className="flex flex-none text-discret">
          <Icon icon={ArrowRight01Icon} size={18} />
        </span>
      </Link>
    </li>
  );
}

function PanneauParcours({ parcours, cartes, progressions }: { parcours: ParcoursCatalogue; cartes: CarteCatalogue[]; progressions: Map<string, ProgressionFormation> }) {
  const formations = formationsDuParcours(cartes, parcours.slug);
  const { pourcentage, terminees, total } = progressionDuParcours(formations, progressions);
  const idListe = `formations-${parcours.slug}`;
  return (
    <div className="flex min-w-0 flex-col">
      <div aria-hidden="true" className="h-px bg-[#DBE0EB]" />
      <div className="mt-8 flex min-w-0 flex-col gap-8">
        <div className="box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau px-[19px] pt-[22px] pb-[17px]">
          <div className="flex items-start gap-4">
            <span className={cn("flex size-12 flex-none items-center justify-center rounded-[14px]", TUILE[parcours.couleur])}>
              <Icon icon={Route01Icon} size={22} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="m-0 text-xl leading-7 font-semibold text-encre">{parcours.nom}</h2>
              {parcours.description && <p className="m-0 text-sm leading-[22px] text-pretty text-discret">{parcours.description}</p>}
            </div>
            {/* Lot 1 : aucun abonnement, aucun parcours actif (les formules arrivent au lot 2). */}
            <Tag tone="enAttente">Non inclus</Tag>
          </div>
          <ProgressBar value={pourcentage} label="Progression du parcours" className="mt-5" />
          <div className="mt-2 flex flex-wrap items-center gap-[7px] text-xs leading-[18px] text-discret">
            <span>{pourcentage} % du parcours</span>
            <MetaDot />
            <span>{formationsTerminees(terminees, total)}</span>
          </div>
        </div>

        <EmptyState
          icon={SquareLock02Icon}
          title="Ce parcours n’est pas inclus dans votre compte gratuit"
          description="Choisissez une formule pour ouvrir toutes ses formations. Les formations gratuites restent accessibles dès maintenant."
          action={
            <Button asChild>
              <Link href="/abonnement">Voir les formules</Link>
            </Button>
          }
        />

        <section aria-labelledby={`${idListe}-titre`} className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id={`${idListe}-titre`} className="m-0 text-xl leading-7 font-semibold text-encre">
              Formations du parcours
            </h2>
            <Tag tone="enAttente">{pluriel(formations.length, "formation")}</Tag>
          </div>
          {formations.length === 0 ? (
            <p className="m-0 text-sm leading-[22px] text-discret">Aucune formation dans ce parcours pour le moment.</p>
          ) : (
            <div className="box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau px-[15px] py-1">
              <ul aria-label={`Formations du parcours ${parcours.nom}`} className="m-0 flex list-none flex-col p-0 [&>li+li]:border-t [&>li+li]:border-bordure-carte">
                {formations.map((carte, index) => (
                  <LigneFormation key={carte.id} carte={carte} rang={index + 1} progression={progressions.get(carte.slug)} />
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Mes parcours (NdParcours) : un onglet par parcours, sa progression et ses formations. */
export function MesParcours({ parcours, cartes, progressions }: Props) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <Heading level="page">Mes parcours</Heading>
          <Lead className="mt-2.5">Compte gratuit : aucun parcours actif. Les formations gratuites restent ouvertes à tous.</Lead>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="contour">
            <Link href="/abonnement">Voir les formules</Link>
          </Button>
        </div>
      </div>
      <div className="mt-[21px]">
        {parcours.length === 0 ? (
          <EmptyState icon={Route01Icon} title="Aucun parcours pour le moment" description="Les parcours s’afficheront ici dès qu’ils seront ouverts." />
        ) : (
          <SegmentedTabs
            label="Choisir un parcours"
            items={parcours.map((p) => ({
              value: p.slug,
              label: p.nomCourt,
              icon: SquareLock02Icon,
              content: <PanneauParcours parcours={p} cartes={cartes} progressions={progressions} />,
            }))}
          />
        )}
      </div>
    </div>
  );
}
