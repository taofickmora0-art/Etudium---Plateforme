"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Banner } from "@/components/ui/Banner";
import { FilterChips } from "@/components/ui/FilterChips";
import { Pagination } from "@/components/ui/Pagination";
import { ProgressBar } from "@/components/ui/Progress";
import { SearchInput } from "@/components/ui/SearchInput";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { Tag } from "@/components/ui/Tag";
import { chercherApprenants } from "@/lib/formateur/actions-apprenants";
import type { PageApprenants } from "@/lib/formateur/apprenants";
import { estFiltreSuivi, ETATS_SUIVI, FILTRES_SUIVI, LIGNES_PAR_PAGE, TON_SUIVI } from "@/lib/formateur/regles-suivi";
import type { FiltreSuivi } from "@/lib/formateur/suivi";
import { dateCourte, initialesCompte, nomAffiche } from "@/lib/utilisateurs/regles";

const DELAI_RECHERCHE_MS = 300;
const COLONNES = ["Apprenant", "Progression", "Commencée le", "Dernière activité", "État"];

type Props = {
  formationId: string;
  /** Le nom d'un apprenant mène à sa fiche : celle du back-office pour l'équipe, celle de l'espace formateur sinon. */
  espace: "admin" | "formateur";
  initial: PageApprenants;
};

const fiche = (espace: Props["espace"], id: string) => (espace === "admin" ? `/admin/utilisateurs/${id}` : `/formateur/etudiants/${id}`);

/**
 * L'onglet « Apprenants » d'une formation (refonte des formations, étape C) : quatre chiffres sur toute la formation, puis
 * les apprenants, les plus récemment actifs d'abord. Filtres et recherche restent dans la page, jamais dans son adresse
 * (un nom est une donnée personnelle).
 */
export function ListeApprenants({ formationId, espace, initial }: Props) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltreSuivi>("tous");
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, demarrer] = useTransition();
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const derniere = useRef(0);

  const charger = (q: string, e: FiltreSuivi, p: number) => {
    if (minuterie.current) clearTimeout(minuterie.current);
    const numero = ++derniere.current;
    setPage(p);
    demarrer(async () => {
      const reponse = await chercherApprenants(formationId, q, e, p).catch(() => ({ ok: false as const, message: "La liste n’a pas pu être chargée. Réessayez." }));
      if (numero !== derniere.current) return;
      if (reponse.ok) {
        setDonnees(reponse.page);
        setErreur(null);
      } else {
        setErreur(reponse.message);
      }
    });
  };

  const { resume } = donnees;
  const chiffres = [
    { label: "Apprenants", valeur: resume.apprenants.toLocaleString("fr-FR") },
    { label: "Progression moyenne", valeur: `${resume.progressionMoyenne} %` },
    { label: "Formation terminée", valeur: resume.terminees.toLocaleString("fr-FR") },
    { label: "À risque", valeur: resume.aRisque.toLocaleString("fr-FR") },
  ];
  const filtreActif = recherche.trim() !== "" || filtre !== "tous";
  const pages = Math.ceil(donnees.total / LIGNES_PAR_PAGE);

  return (
    <div className="flex min-w-0 flex-col gap-6 max-sm:gap-5">
      <ul aria-label="En bref" className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
        {chiffres.map((c) => (
          <li key={c.label} className="flex min-w-0 flex-col justify-between rounded-carte border border-bordure-carte bg-panneau px-4 py-3">
            <span className="text-[13px] leading-5 text-discret">{c.label}</span>
            <span className="mt-1 text-2xl leading-8 font-medium tracking-[-0.01em] text-titre max-sm:text-xl max-sm:leading-7">{c.valeur}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterChips
          label="Filtrer les apprenants"
          options={FILTRES_SUIVI}
          value={filtre}
          onValueChange={(v) => {
            const e = estFiltreSuivi(v) ? v : "tous";
            setFiltre(e);
            charger(recherche, e, 1);
          }}
        />
        <form
          role="search"
          className="min-w-0 flex-[0_1_320px] max-sm:flex-[1_1_100%]"
          onSubmit={(ev) => {
            ev.preventDefault();
            charger(recherche, filtre, 1);
          }}
        >
          <SearchInput
            aria-label="Rechercher un apprenant"
            placeholder="Rechercher un apprenant…"
            autoComplete="off"
            value={recherche}
            onChange={(ev) => {
              const q = ev.target.value;
              setRecherche(q);
              if (minuterie.current) clearTimeout(minuterie.current);
              minuterie.current = setTimeout(() => charger(q, filtre, 1), DELAI_RECHERCHE_MS);
            }}
          />
        </form>
      </div>
      <div className="flex min-w-0 flex-col gap-3.5">
        {erreur && <Banner tone="erreur" title={erreur} />}
        {donnees.lignes.length === 0 ? (
          <p className="m-0 text-sm leading-[22px] text-discret">
            {filtreActif ? "Aucun apprenant ne correspond à cette recherche." : "Personne n’a encore commencé cette formation."}
          </p>
        ) : (
          <TableauListe nom="Apprenants" nomCadre="Tableau des apprenants" colonnes={COLONNES} largeurMin={720} occupe={chargement}>
            {donnees.lignes.map((l) => {
              const nom = nomAffiche(l.prenom, l.nom);
              const pourcentage = l.total > 0 ? (l.terminees / l.total) * 100 : 0;
              return (
                <tr key={l.etudiantId}>
                  <td className={CELLULE_TABLEAU}>
                    <span className="flex items-center gap-2.5 whitespace-nowrap">
                      <Avatar initials={initialesCompte(l.prenom, l.nom, "?")} size={32} />
                      <Link href={fiche(espace, l.etudiantId)} className="focus-etudium font-medium text-encre no-underline hover:underline">
                        {nom}
                      </Link>
                    </span>
                  </td>
                  <td className={CELLULE_TABLEAU}>
                    <span className="flex min-w-[140px] items-center gap-2.5">
                      <ProgressBar value={pourcentage} label={`Progression de ${nom}`} className="w-20 flex-none" />
                      <span className="whitespace-nowrap text-discret">{`${l.terminees} / ${l.total}`}</span>
                    </span>
                  </td>
                  <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{l.premiereOuverture ? dateCourte(l.premiereOuverture) : "—"}</td>
                  <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{l.derniereActivite ? dateCourte(l.derniereActivite) : "—"}</td>
                  <td className={CELLULE_TABLEAU}>
                    <Tag tone={TON_SUIVI[l.etat]}>{ETATS_SUIVI[l.etat]}</Tag>
                  </td>
                </tr>
              );
            })}
          </TableauListe>
        )}
        {pages > 1 && <Pagination page={page} pageCount={pages} onPageChange={(p) => charger(recherche, filtre, p)} label={`${donnees.lignes.length} sur ${donnees.total} apprenants`} />}
      </div>
    </div>
  );
}
