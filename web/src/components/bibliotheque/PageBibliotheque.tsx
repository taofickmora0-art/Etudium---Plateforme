"use client";

import { useId, useMemo, useState } from "react";
import { LibraryIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { GRILLE_CATALOGUE_CONNECTEE, GRILLE_CATALOGUE_PUBLIQUE } from "@/components/ui/grilles";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Heading, Lead } from "@/components/ui/Text";
import {
  adresseLecture,
  ecrireFiltresBibliotheque,
  FILTRES_BIBLIOTHEQUE_VIDES,
  filtrerLivres,
  filtresActifs,
  type FiltresAdresseBibliotheque,
} from "@/lib/bibliotheque/regles";
import type { CarteLivre, CatalogueBibliotheque } from "@/lib/bibliotheque/types";
import { cn } from "@/lib/cn";
import { CarteDeLivre, CarteLivreCompacte } from "./CarteDeLivre";
import { CoeurLivre } from "./CoeurLivre";

type Props = {
  /** « public » : un visiteur, dans le cadre public (bandeau bleu, sans cœur ni reprise) ; « connecte » : la coque de l'appli. */
  variante: "public" | "connecte";
  catalogue: CatalogueBibliotheque;
  /** Les filtres de l'adresse au premier affichage. */
  filtresInitiaux: FiltresAdresseBibliotheque;
  /** « Continuer la lecture » : les livres commencés du compte, du plus récent au plus ancien. */
  lectures: CarteLivre[];
};

const SOUS_TITRE = "Guides, manuels et méthodes pour aller plus loin que les formations, à lire dans le site.";
const compteur = (n: number) => `${n} ${n > 1 ? "livres" : "livre"}`;
/** La rangée « Continuer la lecture » : 6 livres au plus, sur une ligne (elle défile en largeur sur un écran étroit). */
const RANGEE_MAX = 6;

/** Le bandeau bleu du visiteur, comme celui du catalogue public des formations. */
function HerosBibliotheque() {
  return (
    <section className="box-border rounded-panneau bg-bleu trame-points p-[clamp(28px,4.5vw,56px)] text-white">
      <div className="flex max-w-[800px] flex-col gap-4 max-sm:gap-3">
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/14 px-[13px] py-1.5 text-[13px] leading-[18px] font-semibold">Bibliothèque</span>
        <h1 className="m-0 text-[clamp(28px,3.5vw,44px)] leading-[1.08] font-medium tracking-[-0.028em] text-balance text-white">La bibliothèque Étudium</h1>
        <p className="m-0 max-w-[640px] text-[17px] leading-[27px] text-pretty text-[#DDE1FF] max-sm:text-[15px] max-sm:leading-6">
          {SOUS_TITRE} Les fiches sont ouvertes à tous ; la lecture demande un compte.
        </p>
      </div>
    </section>
  );
}

/** « Continuer la lecture » : les livres commencés, qui mènent au lecteur à la dernière page lue. */
function ContinuerLaLecture({ livres }: { livres: CarteLivre[] }) {
  const titre = useId();
  return (
    <section aria-labelledby={titre} className="flex min-w-0 flex-col gap-4">
      <Heading level="section">
        <span id={titre}>Continuer la lecture</span>
      </Heading>
      <ul
        aria-label="Livres commencés"
        className="m-0 grid list-none auto-cols-[minmax(140px,calc((100%-80px)/6))] grid-flow-col gap-4 overflow-x-auto p-0 pb-1 max-sm:-mx-4 max-sm:gap-3 max-sm:px-4"
      >
        {livres.slice(0, RANGEE_MAX).map((livre) => (
          <li key={livre.id} className="min-w-0">
            <CarteLivreCompacte livre={livre} href={adresseLecture(livre.slug)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * La page Bibliothèque (spec du 3 novembre 2026, §2) : la recherche (titre, auteur, mots-clés), les puces « Tous », un
 * parcours par puce et « Gratuits », la liste des catégories ; « Continuer la lecture » pour un compte qui a commencé des
 * livres (sans filtre) ; puis la grille des cartes. Le catalogue est lu une fois : les filtres s'appliquent tout de suite
 * et restent dans l'adresse (?parcours=…&categorie=…&q=…), sans recharger la page, comme le catalogue des formations.
 */
export function PageBibliotheque({ variante, catalogue, filtresInitiaux, lectures }: Props) {
  const [filtres, setFiltres] = useState(filtresInitiaux);
  const visibles = useMemo(() => filtrerLivres(catalogue.livres, filtres), [catalogue.livres, filtres]);
  const connecte = variante === "connecte";
  const actifs = filtresActifs(filtres);
  const vide = catalogue.livres.length === 0;

  const changer = (partiel: Partial<FiltresAdresseBibliotheque>) => {
    const suivants = { ...filtres, ...partiel };
    setFiltres(suivants);
    window.history.replaceState(null, "", `/bibliotheque${ecrireFiltresBibliotheque(suivants)}`);
  };

  // Les parcours et les catégories qui ont des livres (et celui de l'adresse, même vide : il reste visible pour l'enlever).
  const parcours = catalogue.parcours.filter((p) => p.livres > 0 || p.slug === filtres.parcours);
  const categories = catalogue.categories.filter((c) => c.livres > 0 || c.slug === filtres.categorie);
  const puce = filtres.gratuits ? "gratuits" : (filtres.parcours ?? "tous");
  const choisirPuce = (valeur: string) =>
    valeur === "gratuits" ? changer({ gratuits: true, parcours: null }) : changer({ gratuits: false, parcours: valeur === "tous" ? null : valeur });

  const outils = !vide && (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-[1_1_280px]">
          <SearchInput
            aria-label="Rechercher un livre"
            placeholder="Un titre, un auteur, un mot-clé…"
            maxLength={100}
            value={filtres.q}
            onChange={(e) => changer({ q: e.target.value })}
          />
        </div>
        {categories.length > 0 && (
          <div className="min-w-0 flex-[0_1_260px] max-sm:flex-[1_1_100%]">
            <Select
              aria-label="Catégorie"
              value={filtres.categorie ?? ""}
              onValueChange={(v) => changer({ categorie: v || null })}
              options={[{ value: "", label: "Toutes les catégories" }, ...categories.map((c) => ({ value: c.slug, label: c.nom }))]}
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <FilterChips
          label="Filtrer les livres"
          options={[{ value: "tous", label: "Tous" }, ...parcours.map((p) => ({ value: p.slug, label: p.nomCourt })), { value: "gratuits", label: "Gratuits" }]}
          value={puce}
          onValueChange={choisirPuce}
          className="max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] max-sm:[&>button]:flex-none"
        />
        {visibles.length > 0 && (
          <span role="status" className="text-sm leading-[22px] text-discret max-sm:text-[13px]">
            {compteur(visibles.length)}
          </span>
        )}
      </div>
    </div>
  );

  const resultats = vide ? (
    <EmptyState
      icon={LibraryIcon}
      title="Aucun livre pour le moment"
      description="L’équipe Étudium ajoute régulièrement des guides et des livres : revenez un peu plus tard."
      className={cn(!connecte && "border-0")}
    />
  ) : visibles.length === 0 ? (
    <EmptyState
      icon={Search01Icon}
      title="Aucun livre ne correspond"
      description="Essayez un autre mot-clé ou retirez un filtre."
      className={cn(!connecte && "border-0")}
      action={
        <Button variant="contour" onClick={() => changer(FILTRES_BIBLIOTHEQUE_VIDES)}>
          Effacer les filtres
        </Button>
      }
    />
  ) : (
    <ul aria-label="Livres de la bibliothèque" className={cn("m-0 list-none p-0", connecte ? GRILLE_CATALOGUE_CONNECTEE : GRILLE_CATALOGUE_PUBLIQUE)}>
      {visibles.map((livre) => (
        <li key={livre.id} className="flex min-w-0 [&>*]:flex-1">
          <CarteDeLivre livre={livre} coeur={connecte ? <CoeurLivre livreId={livre.id} titre={livre.titre} favoriInitial={livre.favori} /> : undefined} />
        </li>
      ))}
    </ul>
  );

  if (!connecte) {
    return (
      <>
        <HerosBibliotheque />
        <section aria-label="Livres" className="box-border flex-1 rounded-panneau bg-panneau p-[clamp(24px,4vw,40px)] max-sm:p-4">
          {outils}
          {outils && <div aria-hidden="true" className="mt-7 mb-6 h-px bg-bordure-carte max-sm:mt-5 max-sm:mb-4" />}
          {resultats}
        </section>
      </>
    );
  }

  const reprise = !actifs && lectures.length > 0;
  return (
    <div className="flex flex-col">
      <div className="min-w-0">
        <Heading level="page">Bibliothèque</Heading>
        <Lead className="mt-2.5">{SOUS_TITRE}</Lead>
      </div>
      {reprise && (
        <div className="mt-7 min-w-0">
          <ContinuerLaLecture livres={lectures} />
        </div>
      )}
      {reprise && (
        <Heading level="section" className="mt-9">
          Tous les livres
        </Heading>
      )}
      {outils && <div className={reprise ? "mt-4" : "mt-[21px]"}>{outils}</div>}
      <div aria-hidden="true" className="mt-5 h-px bg-[#DBE0EB]" />
      <div className="mt-8 max-sm:mt-6">{resultats}</div>
    </div>
  );
}
