"use client";

import { useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Banner } from "@/components/ui/Banner";
import { FilterChips } from "@/components/ui/FilterChips";
import { Pagination } from "@/components/ui/Pagination";
import { ProgressBar } from "@/components/ui/Progress";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { Tag } from "@/components/ui/Tag";
import { chercherSuivi } from "@/lib/formateur/actions";
import { estFiltreSuivi, ETATS_SUIVI, FILTRES_SUIVI, LIGNES_PAR_PAGE, TON_SUIVI } from "@/lib/formateur/regles-suivi";
import type { FiltreSuivi, PageSuivi } from "@/lib/formateur/suivi";
import { dateCourte, initialesCompte, nomAffiche } from "@/lib/utilisateurs/regles";

const DELAI_RECHERCHE_MS = 300;
const COLONNES = ["Étudiant", "Formation", "Progression", "Dernière activité", "État"];

type Props = {
  initial: PageSuivi;
  /** Ses formations, pour le filtre « Formation ». */
  formations: { id: string; titre: string }[];
};

/**
 * Les étudiants du formateur (spec « Étudiants », §3) : une ligne par étudiant et par formation, les plus récemment
 * actifs d'abord. Filtres et recherche restent dans la page, jamais dans son adresse (un nom est une donnée personnelle).
 */
export function ListeEtudiants({ initial, formations }: Props) {
  const idFormation = useId();
  const [recherche, setRecherche] = useState("");
  const [formation, setFormation] = useState("");
  const [filtre, setFiltre] = useState<FiltreSuivi>("tous");
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, demarrer] = useTransition();
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const derniere = useRef(0);

  const charger = (q: string, f: string, e: FiltreSuivi, p: number) => {
    if (minuterie.current) clearTimeout(minuterie.current);
    const numero = ++derniere.current;
    setPage(p);
    demarrer(async () => {
      const reponse = await chercherSuivi(q, f || null, e, p);
      if (numero !== derniere.current) return;
      if (reponse.ok) {
        setDonnees(reponse.page);
        setErreur(null);
      } else {
        setErreur(reponse.message);
      }
    });
  };

  const filtreActif = recherche.trim() !== "" || formation !== "" || filtre !== "tous";
  const pages = Math.ceil(donnees.total / LIGNES_PAR_PAGE);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterChips
          label="Filtrer les étudiants"
          options={FILTRES_SUIVI}
          value={filtre}
          onValueChange={(v) => {
            const e = estFiltreSuivi(v) ? v : "tous";
            setFiltre(e);
            charger(recherche, formation, e, 1);
          }}
        />
        <div className="flex min-w-0 flex-[0_1_560px] flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
            <label htmlFor={idFormation} className="text-sm leading-5 font-medium text-encre">
              Formation
            </label>
            <Select
              id={idFormation}
              value={formation}
              onChange={(ev) => {
                setFormation(ev.target.value);
                charger(recherche, ev.target.value, filtre, 1);
              }}
              options={[{ value: "", label: "Toutes les formations" }, ...formations.map((f) => ({ value: f.id, label: f.titre }))]}
            />
          </div>
          <form
            role="search"
            className="min-w-0 flex-[1_1_220px]"
            onSubmit={(ev) => {
              ev.preventDefault();
              charger(recherche, formation, filtre, 1);
            }}
          >
            <SearchInput
              aria-label="Rechercher un étudiant"
              placeholder="Rechercher un étudiant…"
              autoComplete="off"
              value={recherche}
              onChange={(ev) => {
                const q = ev.target.value;
                setRecherche(q);
                if (minuterie.current) clearTimeout(minuterie.current);
                minuterie.current = setTimeout(() => charger(q, formation, filtre, 1), DELAI_RECHERCHE_MS);
              }}
            />
          </form>
        </div>
      </div>
      <div className="mt-5 h-px bg-bordure-carte" />
      <div className="mt-8 flex min-w-0 flex-col gap-3.5">
        {erreur && <Banner tone="erreur" title={erreur} />}
        {donnees.lignes.length === 0 ? (
          <p className="m-0 text-sm leading-[22px] text-discret">
            {filtreActif ? "Aucun étudiant ne correspond à cette recherche." : "Aucun étudiant ne suit encore vos formations."}
          </p>
        ) : (
          <TableauListe nom="Étudiants" nomCadre="Tableau des étudiants" colonnes={COLONNES} largeurMin={760} occupe={chargement}>
            {donnees.lignes.map((l) => {
              const nom = nomAffiche(l.prenom, l.nom);
              const pourcentage = l.total > 0 ? (l.terminees / l.total) * 100 : 0;
              return (
                <tr key={`${l.etudiantId}-${l.formationId}`}>
                  <td className={CELLULE_TABLEAU}>
                    <span className="flex items-center gap-2.5 whitespace-nowrap">
                      <Avatar initials={initialesCompte(l.prenom, l.nom, "?")} size={32} />
                      <Link href={`/formateur/etudiants/${l.etudiantId}`} className="focus-etudium font-medium text-encre no-underline hover:underline">
                        {nom}
                      </Link>
                    </span>
                  </td>
                  <td className={CELLULE_TABLEAU}>{l.formationTitre}</td>
                  <td className={CELLULE_TABLEAU}>
                    <span className="flex min-w-[140px] items-center gap-2.5">
                      <ProgressBar value={pourcentage} label={`Progression de ${nom}`} className="w-20 flex-none" />
                      <span className="whitespace-nowrap text-discret">{`${l.terminees} / ${l.total}`}</span>
                    </span>
                  </td>
                  <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{dateCourte(l.derniereActivite)}</td>
                  <td className={CELLULE_TABLEAU}>
                    <Tag tone={TON_SUIVI[l.etat]}>{ETATS_SUIVI[l.etat]}</Tag>
                  </td>
                </tr>
              );
            })}
          </TableauListe>
        )}
        {pages > 1 && (
          <Pagination page={page} pageCount={pages} onPageChange={(p) => charger(recherche, formation, filtre, p)} label={`${donnees.lignes.length} sur ${donnees.total} lignes`} />
        )}
      </div>
    </div>
  );
}
