import Link from "next/link";
import { ArrowRight01Icon, Cancel01Icon, PlayCircleIcon, Route01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { CarteFormation } from "@/components/catalogue/CarteFormation";
import { CarteSuivie, type VueCarteSuivie } from "@/components/mes-formations/CarteSuivie";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { GRILLE_CARTES } from "@/components/ui/grilles";
import { Groupe } from "@/components/ui/Groupe";
import { Icon } from "@/components/ui/Icon";
import { SearchInput } from "@/components/ui/SearchInput";
import { Tag } from "@/components/ui/Tag";
import { Heading, Lead } from "@/components/ui/Text";
import { formatDuree } from "@/lib/admin/duree";
import type { CarteCatalogue, ParcoursCatalogue } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import type { CouleurParcours } from "@/lib/contenus/libelles";
import type { LeconTrouvable, Resultats } from "@/lib/recherche/regles";

type Props = {
  q: string;
  /** Null sans requête. */
  resultats: Resultats | null;
  /** Toutes les formations publiées (nombre de formations de chaque parcours). */
  cartes: CarteCatalogue[];
  recommandees: CarteCatalogue[];
  /** Formations commencées : leur carte montre la progression. */
  suivies: ReadonlyMap<string, VueCarteSuivie>;
  /** Leçons terminées du compte. */
  terminees: ReadonlySet<string>;
};

/** Leçons montrées au plus ; au-delà, la page invite à préciser la recherche. */
const LECONS_MAX = 20;
const TUILE: Record<CouleurParcours, string> = {
  academique: "bg-bleu-pale text-bleu",
  digital: "bg-premium-fond text-premium-texte",
  business: "bg-[#FFEDD9] text-business-texte",
};

const pluriel = (n: number, mot: string) => `${n} ${n > 1 ? `${mot}s` : mot}`;

/** Un parcours trouvé (annexe §6.5 b) : tuile à sa couleur, nom, description, nombre de formations. */
function CarteParcours({ parcours, formations }: { parcours: ParcoursCatalogue; formations: number }) {
  return (
    <Link
      href="/parcours"
      className="focus-etudium box-border flex min-w-0 flex-1 flex-col rounded-carte border border-bordure-carte bg-panneau px-[19px] pt-[22px] pb-[17px] text-inherit no-underline transition-colors hover:border-bordure-champ"
    >
      <span className={cn("flex size-12 items-center justify-center rounded-[14px]", TUILE[parcours.couleur])}>
        <Icon icon={Route01Icon} size={22} />
      </span>
      <h3 title={parcours.nom} className="mt-[21px] mb-0 truncate text-base leading-6 font-semibold text-encre">
        {parcours.nom}
      </h3>
      <p className="mt-[11px] mb-0 line-clamp-2 h-10 text-xs leading-5 text-discret">{parcours.description}</p>
      <div aria-hidden="true" className="mt-4 h-px bg-bordure-carte" />
      <span className="mt-3 text-xs leading-[18px] text-discret">{pluriel(formations, "formation")}</span>
    </Link>
  );
}

/** Une leçon trouvée (annexe §6.6) : vers la leçon si elle est ouverte, sinon vers la fiche de sa formation. */
function LigneLecon({ lecon, terminee }: { lecon: LeconTrouvable; terminee: boolean }) {
  const href = lecon.accessible ? `/formations/${lecon.formation.slug}/lecons/${lecon.id}` : `/formations/${lecon.formation.slug}`;
  return (
    <li>
      <Link href={href} className="focus-etudium flex min-h-12 items-center gap-3.5 px-1 py-3.5 text-inherit no-underline transition-colors hover:bg-page">
        <span className="flex size-11 flex-none items-center justify-center rounded-[13px] bg-coque text-texte">
          <Icon icon={PlayCircleIcon} size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] leading-[22px] font-medium text-encre">{lecon.titre}</span>
          <span className="text-[13px] leading-5 text-discret">{`${lecon.formation.titre} · Module ${lecon.module.numero} : ${lecon.module.titre}`}</span>
        </span>
        <span className="flex-none text-xs leading-[18px] text-discret max-sm:hidden">{formatDuree(lecon.dureeSecondes)}</span>
        {terminee && <Tag tone="valide">Terminée</Tag>}
        <span className="flex flex-none text-discret">
          <Icon icon={ArrowRight01Icon} size={18} />
        </span>
      </Link>
    </li>
  );
}

/**
 * Recherche (NdRecherche, NdRechercheVide) : formations, parcours et leçons publiés, sans accents ni majuscules.
 * Les sessions live arriveront avec leur lot (5). Sans requête ou sans résultat : « Recommandé pour vous ».
 */
export function PageRecherche({ q, resultats, cartes, recommandees, suivies, terminees }: Props) {
  const total = resultats?.total ?? 0;
  const lecons = resultats?.lecons ?? [];
  const recommandations = recommandees.length > 0 && (
    <Groupe titre="Recommandé pour vous" lien={{ href: "/formations", libelle: "Tout voir" }}>
      <div className={GRILLE_CARTES}>
        {recommandees.map((carte) => (
          <CarteFormation key={carte.id} carte={carte} variante="connecte" />
        ))}
      </div>
    </Groupe>
  );

  return (
    <div className="flex flex-col">
      <div className="min-w-0">
        <Heading level="page">Recherche</Heading>
        <Lead className="mt-2.5">Formations, parcours et leçons.</Lead>
      </div>
      <form role="search" action="/recherche" method="get" className="mt-[21px] flex max-w-[720px] flex-wrap gap-2">
        <div className="relative min-w-0 flex-[1_1_280px]">
          <SearchInput name="q" defaultValue={q} maxLength={100} aria-label="Rechercher une formation, un parcours ou une leçon" placeholder="Une formation, un parcours, une leçon…" className="pr-12" />
          {q && (
            <Link
              href="/recherche"
              aria-label="Effacer la recherche"
              className="focus-etudium absolute top-1.5 right-1.5 flex size-[34px] items-center justify-center rounded-puce text-texte no-underline transition-colors hover:bg-coque"
            >
              <Icon icon={Cancel01Icon} size={16} />
            </Link>
          )}
        </div>
        <Button type="submit" size="lg">
          Rechercher
        </Button>
      </form>
      <div aria-hidden="true" className="mt-5 h-px bg-separateur" />
      <div className="mt-8 flex min-w-0 flex-col gap-8">
        {resultats && total > 0 && (
          <>
            <p role="status" className="-mt-2 mb-0 text-sm leading-[22px] text-pretty text-discret">
              {`${pluriel(total, "résultat")} pour « ${q} »`}
            </p>
            {resultats.formations.length > 0 && (
              <Groupe titre="Formations" etiquette={String(resultats.formations.length)}>
                <div className={GRILLE_CARTES}>
                  {resultats.formations.map((carte) => {
                    const suivie = suivies.get(carte.id);
                    return suivie ? <CarteSuivie key={carte.id} vue={suivie} /> : <CarteFormation key={carte.id} carte={carte} variante="connecte" />;
                  })}
                </div>
              </Groupe>
            )}
            {resultats.parcours.length > 0 && (
              <Groupe titre="Parcours" etiquette={String(resultats.parcours.length)}>
                <div className={GRILLE_CARTES}>
                  {resultats.parcours.map((p) => (
                    <CarteParcours key={p.slug} parcours={p} formations={cartes.filter((c) => c.parcours.some((x) => x.slug === p.slug)).length} />
                  ))}
                </div>
              </Groupe>
            )}
            {lecons.length > 0 && (
              <Groupe titre="Leçons" etiquette={String(lecons.length)}>
                <div className="box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau px-[15px] py-1">
                  <ul className="m-0 flex list-none flex-col p-0 [&>li+li]:border-t [&>li+li]:border-bordure-carte">
                    {lecons.slice(0, LECONS_MAX).map((lecon) => (
                      <LigneLecon key={lecon.id} lecon={lecon} terminee={terminees.has(lecon.id)} />
                    ))}
                  </ul>
                </div>
                {lecons.length > LECONS_MAX && (
                  <p className="m-0 text-sm leading-[22px] text-discret">{`Et ${pluriel(lecons.length - LECONS_MAX, "autre leçon")} : précisez votre recherche.`}</p>
                )}
              </Groupe>
            )}
          </>
        )}
        {resultats && total === 0 && (
          <>
            <EmptyState
              icon={Search01Icon}
              title={`Aucun résultat pour « ${q} »`}
              description="Vérifiez l’orthographe ou essayez un mot plus général."
              action={
                <>
                  <Button asChild variant="contour">
                    <Link href="/recherche">Effacer la recherche</Link>
                  </Button>
                  <Button asChild variant="gris">
                    <Link href="/formations">Parcourir le catalogue</Link>
                  </Button>
                </>
              }
            />
            {recommandations}
          </>
        )}
        {!resultats && recommandations}
      </div>
    </div>
  );
}
