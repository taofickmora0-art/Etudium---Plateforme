"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/Icon";
import { SearchInput } from "@/components/ui/SearchInput";
import { SortMenu } from "@/components/ui/SortMenu";
import { Heading, Lead } from "@/components/ui/Text";
import { appliquerFiltres, ecrireFiltres, FILTRES_PAR_DEFAUT, type Acces, type Filtres, type Tri } from "@/lib/catalogue/filtres";
import type { CarteCatalogue, ParcoursCatalogue } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import { NIVEAUX } from "@/lib/contenus/libelles";
import { CarteFormation } from "./CarteFormation";
import { HerosCatalogue, SOUS_TITRE_CATALOGUE } from "./HerosCatalogue";

type CatalogueProps = {
  cartes: CarteCatalogue[];
  parcours: ParcoursCatalogue[];
  filtresInitiaux: Filtres;
  variante: "public" | "connecte";
  /** « /formations-gratuites » : la page « Formations gratuites » du menu de l'espace connecté. */
  chemin: "/formations" | "/formations-gratuites";
  /** Filtres fixés par la page (« Formations gratuites ») : « Effacer les filtres » y revient. */
  imposer?: Partial<Filtres>;
  /** Page Formations du compte connecté : la rangée « Mes formations », sous le titre. */
  rangee?: ReactNode;
};

const TRIS: { value: Tri; label: string }[] = [
  { value: "parcours", label: "Parcours" },
  { value: "recentes", label: "Les plus récentes" },
  { value: "note", label: "Note des étudiants" },
  { value: "duree", label: "Durée" },
];

const ACCES: { value: Acces; label: string }[] = [
  { value: "tout", label: "Tout" },
  { value: "gratuites", label: "Gratuites" },
  { value: "incluses", label: "Incluses dans un abonnement" },
];

const compteur = (n: number) => `${n} ${n > 1 ? "formations" : "formation"}`;

const GRILLE_PUBLIQUE = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(250px,calc((100%-60px)/4))),1fr))] gap-5";
// Connecté : 5 colonnes au plus, cartes de 190 px au moins (4 à 5 sur ordinateur ; spec Formations et Événements, §2).
const GRILLE_CONNECTEE = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(190px,calc((100%-80px)/5))),1fr))] gap-5";

/**
 * Catalogue des formations (NdCataloguePublic pour un visiteur, NdCatalogue et NdMobCatalogue pour un compte connecté).
 * Les filtres s'appliquent tout de suite et restent dans l'adresse, sans recharger la page.
 */
/**
 * La version connectée n'a ni liste « Niveau » ni puce « Incluses » : ces filtres venus de l'adresse (lien copié depuis
 * le catalogue public) cacheraient des formations sans moyen de les retirer. On les ignore.
 */
const pourVariante = (f: Filtres, variante: CatalogueProps["variante"]): Filtres =>
  variante === "connecte" ? { ...f, niveau: "tous", acces: f.acces === "incluses" ? "tout" : f.acces } : f;

export function Catalogue({ cartes, parcours, filtresInitiaux, variante, chemin, imposer, rangee }: CatalogueProps) {
  const router = useRouter();
  const base: Filtres = { ...FILTRES_PAR_DEFAUT, ...imposer };
  const [filtres, setFiltres] = useState(() => pourVariante(filtresInitiaux, variante));
  const visibles = useMemo(() => appliquerFiltres(cartes, filtres), [cartes, filtres]);
  const niveaux = NIVEAUX.filter((n) => cartes.some((c) => c.niveau === n.value));

  const changer = (partiel: Partial<Filtres>) => {
    const suivants = { ...filtres, ...partiel };
    setFiltres(suivants);
    window.history.replaceState(null, "", `${chemin}${ecrireFiltres(suivants, base)}`);
  };

  const vide = (
    <EmptyState
      icon={Search01Icon}
      title="Aucune formation ne correspond"
      description="Essayez un autre mot-clé ou retirez un filtre."
      className="border-0"
      action={
        <Button variant="contour" onClick={() => changer({ ...base, tri: filtres.tri })}>
          Effacer les filtres
        </Button>
      }
    />
  );
  const grille = (classe: string) =>
    visibles.length === 0 ? (
      vide
    ) : (
      <div className={classe}>
        {visibles.map((carte) => (
          <CarteFormation key={carte.id} carte={carte} variante={variante} />
        ))}
      </div>
    );

  if (variante === "public") {
    return (
      <>
        <HerosCatalogue />
        <section aria-label="Formations" className="box-border flex-1 rounded-panneau bg-panneau p-[clamp(24px,4vw,40px)]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex max-w-[560px] min-w-0 flex-[1_1_320px] flex-col gap-1.5">
                <label htmlFor="catalogue-recherche" className="text-sm leading-5 font-medium text-encre">
                  Rechercher
                </label>
                <SearchInput id="catalogue-recherche" placeholder="Rechercher une formation…" value={filtres.q} onChange={(e) => changer({ q: e.target.value })} />
              </div>
              <div className="flex min-w-0 flex-[0_1_220px] flex-col gap-1.5">
                <label htmlFor="catalogue-niveau" className="text-sm leading-5 font-medium text-encre">
                  Niveau
                </label>
                <span className="relative block">
                  <select
                    id="catalogue-niveau"
                    value={filtres.niveau}
                    onChange={(e) => changer({ niveau: e.target.value as Filtres["niveau"] })}
                    className="focus-etudium box-border h-12 w-full cursor-pointer appearance-none rounded-champ border border-bordure-champ bg-panneau pr-10 pl-3.5 text-[15px] text-texte"
                  >
                    <option value="tous">Tous les niveaux</option>
                    {niveaux.map((n) => (
                      <option key={n.value} value={n.value}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute top-[15px] right-3.5 text-discret">
                    <Icon icon={ArrowDown01Icon} size={18} />
                  </span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3.5">
              <FilterChips
                label="Filtrer par parcours"
                options={[{ value: "tous", label: "Tous les parcours" }, ...parcours.map((p) => ({ value: p.slug, label: p.nomCourt }))]}
                value={filtres.parcours}
                onValueChange={(v) => changer({ parcours: v })}
              />
              <span aria-hidden="true" className="h-7 w-px bg-bordure" />
              <FilterChips label="Filtrer par accès" options={ACCES} value={filtres.acces} onValueChange={(v) => changer({ acces: v as Acces })} />
            </div>
          </div>
          <div aria-hidden="true" className="mt-7 mb-6 h-px bg-bordure-carte" />
          <div className="flex min-w-0 flex-col gap-4">
            {visibles.length > 0 && (
              <p role="status" className="m-0 text-sm leading-[22px] text-pretty text-discret">
                {compteur(visibles.length)}
              </p>
            )}
            {grille(GRILLE_PUBLIQUE)}
          </div>
        </section>
      </>
    );
  }

  // Connecté : « Gratuites » est la page « Formations gratuites » du menu ; les autres puces, « Toutes les formations ».
  const pucePourFiltres = filtres.acces === "gratuites" ? "gratuites" : filtres.parcours;
  const choisirPuce = (valeur: string) => {
    if (valeur === "gratuites") {
      if (chemin !== "/formations-gratuites") return router.push("/formations-gratuites");
      return changer({ parcours: "tous", acces: "gratuites" });
    }
    const suivants = { ...filtres, parcours: valeur, acces: "tout" as const };
    if (chemin === "/formations-gratuites") return router.push(`/formations${ecrireFiltres(suivants)}`);
    changer({ parcours: valeur, acces: "tout" });
  };
  const triChoisi = TRIS.find((t) => t.value === filtres.tri) ?? TRIS[0];

  // La page Formations : « Mes formations », puis « Toutes les formations » en section ; « Formations gratuites » garde son titre.
  const pageFormations = chemin === "/formations";
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <Heading level="page">{pageFormations ? "Formations" : "Formations gratuites"}</Heading>
          <Lead className="mt-2.5">{SOUS_TITRE_CATALOGUE}</Lead>
        </div>
      </div>
      {rangee && <div className="mt-7 min-w-0">{rangee}</div>}
      {pageFormations && (
        <Heading level="section" className={rangee ? "mt-9" : "mt-7"}>
          Toutes les formations
        </Heading>
      )}
      <div className={cn("flex min-w-0 flex-col gap-3.5", pageFormations ? "mt-4" : "mt-[21px]")}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-[1_1_280px]">
            <SearchInput aria-label="Rechercher une formation" placeholder="Rechercher une formation…" value={filtres.q} onChange={(e) => changer({ q: e.target.value })} />
          </div>
          <SortMenu
            options={TRIS}
            value={filtres.tri}
            onValueChange={(v) => changer({ tri: v as Tri })}
            triggerLabel={`Trier : ${triChoisi.label.toLowerCase()}`}
            triggerClassName="h-12"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <FilterChips
            label="Filtrer par parcours"
            options={[
              { value: "tous", label: "Toutes" },
              ...parcours.map((p) => ({ value: p.slug, label: p.nomCourt })),
              { value: "gratuites", label: "Gratuites" },
            ]}
            value={pucePourFiltres}
            onValueChange={choisirPuce}
            className={cn("max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] max-sm:[&>button]:flex-none")}
          />
          {visibles.length > 0 && (
            <span role="status" className="text-sm leading-[22px] text-discret">
              {compteur(visibles.length)}
            </span>
          )}
        </div>
      </div>
      <div aria-hidden="true" className="mt-5 h-px bg-[#DBE0EB]" />
      <div className="mt-8">{grille(GRILLE_CONNECTEE)}</div>
    </div>
  );
}
