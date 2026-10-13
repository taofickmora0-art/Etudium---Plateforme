"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Banner } from "@/components/ui/Banner";
import { FilterChips } from "@/components/ui/FilterChips";
import { List, ListRow } from "@/components/ui/ListRow";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { chercherComptes } from "@/lib/utilisateurs/actions";
import { COMPTES_PAR_PAGE, dateCourte, estFiltre, FILTRES_COMPTES, initialesCompte, nomAffiche } from "@/lib/utilisateurs/regles";
import type { CompteResume, FiltreComptes, PageComptes } from "@/lib/utilisateurs/types";
import { EtiquettesRoles } from "./EtiquettesRoles";

const DELAI_RECHERCHE_MS = 300;

const sousTitre = (c: CompteResume) =>
  `${c.email} · Inscrit le ${dateCourte(c.inscritLe)} · Dernière connexion : ${c.derniereConnexion ? dateCourte(c.derniereConnexion) : "Jamais"}`;

/**
 * Liste des comptes (spec des utilisateurs, §2) : recherche par nom ou adresse, filtres, pages de 25. Recherche, filtre
 * et page restent dans la page, jamais dans son adresse (une adresse e-mail est une donnée personnelle) : chaque
 * changement passe par l'action chercherComptes. Seule la dernière réponse demandée est affichée.
 */
export function ListeComptes({ initial }: { initial: PageComptes }) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltreComptes>("tous");
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, demarrer] = useTransition();
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const derniere = useRef(0);

  const charger = (q: string, f: FiltreComptes, p: number) => {
    if (minuterie.current) clearTimeout(minuterie.current);
    const numero = ++derniere.current;
    setPage(p);
    demarrer(async () => {
      const reponse = await chercherComptes(q, f, p);
      if (numero !== derniere.current) return;
      if (reponse.ok) {
        setDonnees(reponse.page);
        setErreur(null);
      } else {
        setErreur(reponse.message);
      }
    });
  };

  const pages = Math.ceil(donnees.total / COMPTES_PAR_PAGE);

  return (
    <div className="flex max-w-[760px] min-w-0 flex-col gap-4">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          charger(recherche, filtre, 1);
        }}
      >
        <SearchInput
          aria-label="Rechercher un compte"
          placeholder="Nom ou adresse e-mail"
          autoComplete="off"
          value={recherche}
          onChange={(e) => {
            const q = e.target.value;
            setRecherche(q);
            if (minuterie.current) clearTimeout(minuterie.current);
            minuterie.current = setTimeout(() => charger(q, filtre, 1), DELAI_RECHERCHE_MS);
          }}
        />
      </form>
      <FilterChips
        label="Filtrer les comptes"
        options={FILTRES_COMPTES}
        value={filtre}
        onValueChange={(v) => {
          const f = estFiltre(v) ? v : "tous";
          setFiltre(f);
          charger(recherche, f, 1);
        }}
      />
      {erreur && <Banner tone="erreur" title={erreur} />}
      {donnees.comptes.length === 0 ? (
        <p className="m-0 text-sm leading-[22px] text-discret">Aucun compte ne correspond à cette recherche.</p>
      ) : (
        <div aria-busy={chargement} className="rounded-carte border border-bordure-carte bg-panneau px-4">
          <List label="Comptes">
            {donnees.comptes.map((c) => (
              <ListRow
                key={c.id}
                leading={<Avatar initials={initialesCompte(c.prenom, c.nom, c.email)} size={44} />}
                title={nomAffiche(c.prenom, c.nom)}
                subtitle={sousTitre(c)}
                trailing={<EtiquettesRoles roles={c.roles} suspendu={c.suspendu} />}
                href={`/admin/utilisateurs/${c.id}`}
              />
            ))}
          </List>
        </div>
      )}
      {pages > 1 && (
        <Pagination
          page={page}
          pageCount={pages}
          onPageChange={(p) => charger(recherche, filtre, p)}
          label={`${donnees.total} comptes`}
        />
      )}
    </div>
  );
}
