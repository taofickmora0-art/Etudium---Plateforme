"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Banner } from "@/components/ui/Banner";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, type MenuEntry } from "@/components/ui/Menu";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { Tag } from "@/components/ui/Tag";
import type { Role } from "@/lib/auth/permissions";
import { chercherComptes } from "@/lib/utilisateurs/actions";
import {
  COMPTES_PAR_PAGE,
  dateNumerique,
  droitsSurCompte,
  estFiltre,
  FILTRES_COMPTES,
  formuleAffichee,
  initialesCompte,
  LIBELLES_ROLES,
  nomAffiche,
  nomCourt,
  rolePrincipal,
} from "@/lib/utilisateurs/regles";
import type { CompteResume, FiltreComptes, PageComptes } from "@/lib/utilisateurs/types";
import { FenetreRole } from "./FenetreRole";
import { FenetresSuspension, type FenetreSuspension } from "./FenetresSuspension";

const DELAI_RECHERCHE_MS = 300;
const COLONNES = ["Utilisateur", "E-mail", "Rôle", "Formule", "Statut", "Inscrit le"];

type Props = {
  initial: PageComptes;
  /** La personne connectée : ses droits décident des actions proposées (la base les revérifie). */
  moi: { id: string; roles: Role[] };
};

/**
 * Liste des comptes (spec des utilisateurs, §2 ; design NdAdminUtilisateurs) : filtres, recherche par nom ou adresse,
 * tableau de 25 comptes par page, menu d'actions par ligne. Recherche, filtre et page restent dans la page, jamais dans
 * son adresse (une adresse e-mail est une donnée personnelle) : chaque changement passe par l'action chercherComptes.
 */
export function ListeComptes({ initial, moi }: Props) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltreComptes>("tous");
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, demarrer] = useTransition();
  const [cible, setCible] = useState<{ id: string; nomCourt: string; role: Role }>({ id: "", nomCourt: "", role: "etudiant" });
  const [fenetre, setFenetre] = useState<FenetreSuspension | "role">(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const derniere = useRef(0);
  // Une entrée du menu ouvre une fenêtre : le menu, en se fermant, ne doit pas lui reprendre le focus.
  const fenetreDemandee = useRef(false);

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

  const actions = (c: CompteResume): MenuEntry[] => {
    const droits = droitsSurCompte(moi, c);
    const ouvrir = (quoi: FenetreSuspension | "role") => () => {
      fenetreDemandee.current = true;
      setCible({ id: c.id, nomCourt: nomCourt(c.prenom, c.nom, c.email), role: rolePrincipal(c.roles) });
      setFenetre(quoi);
    };
    return [
      { label: "Voir le profil", href: `/admin/utilisateurs/${c.id}` },
      ...(droits.changerRole ? [{ label: "Changer le rôle", onSelect: ouvrir("role") }] : []),
      ...(droits.suspendre ? [{ label: "Suspendre le compte", danger: true, onSelect: ouvrir("suspendre") }] : []),
      ...(droits.reactiver ? [{ label: "Réactiver le compte", onSelect: ouvrir("reactiver") }] : []),
    ];
  };

  const pages = Math.ceil(donnees.total / COMPTES_PAR_PAGE);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Filtrer les utilisateurs"
          options={FILTRES_COMPTES}
          value={filtre}
          onValueChange={(v) => {
            const f = estFiltre(v) ? v : "tous";
            setFiltre(f);
            charger(recherche, f, 1);
          }}
        />
        <form
          role="search"
          className="min-w-0 flex-[0_1_300px]"
          onSubmit={(e) => {
            e.preventDefault();
            charger(recherche, filtre, 1);
          }}
        >
          <SearchInput
            aria-label="Rechercher un utilisateur"
            placeholder="Rechercher un utilisateur…"
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
      </div>
      <div className="mt-5 h-px bg-bordure-carte" />
      <div className="mt-8 flex min-w-0 flex-col gap-3.5">
        {erreur && <Banner tone="erreur" title={erreur} />}
        {donnees.comptes.length === 0 ? (
          <p className="m-0 text-sm leading-[22px] text-discret">Aucun compte ne correspond à cette recherche.</p>
        ) : (
          <TableauListe nom="Comptes" nomCadre="Tableau des comptes" colonnes={COLONNES} actions occupe={chargement}>
            {donnees.comptes.map((c) => {
              const nom = nomAffiche(c.prenom, c.nom);
              const nomActions = nom === "Sans nom" ? c.email : nom;
              return (
                <tr key={c.id}>
                  <td className={CELLULE_TABLEAU}>
                    <span className="flex items-center gap-2.5 whitespace-nowrap">
                      <Avatar initials={initialesCompte(c.prenom, c.nom, c.email)} size={32} />
                      <Link href={`/admin/utilisateurs/${c.id}`} className="focus-etudium font-medium text-encre no-underline hover:underline">
                        {nom}
                      </Link>
                    </span>
                  </td>
                  <td className={CELLULE_TABLEAU}>{c.email}</td>
                  <td className={CELLULE_TABLEAU}>{LIBELLES_ROLES[rolePrincipal(c.roles)]}</td>
                  <td className={CELLULE_TABLEAU}>{formuleAffichee(c.roles) === "Gratuit" ? <Tag tone="enAttente">Gratuit</Tag> : "—"}</td>
                  <td className={CELLULE_TABLEAU}>{c.suspendu ? <Tag tone="echoue">Suspendu</Tag> : <Tag tone="valide">Actif</Tag>}</td>
                  <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{dateNumerique(c.inscritLe)}</td>
                  <td className={`${CELLULE_TABLEAU} text-right`}>
                    <Menu
                      label={`Actions pour ${nomActions}`}
                      trigger={<IconButton icon={MoreVerticalIcon} label={`Actions pour ${nomActions}`} variant="discret" size="sm" data-actions-compte={c.id} />}
                      items={actions(c)}
                      rendreLeFocus={() => {
                        const rendre = !fenetreDemandee.current;
                        fenetreDemandee.current = false;
                        return rendre;
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </TableauListe>
        )}
        {pages > 1 && (
          <Pagination page={page} pageCount={pages} onPageChange={(p) => charger(recherche, filtre, p)} label={`${donnees.comptes.length} sur ${donnees.total} utilisateurs`} />
        )}
      </div>
      <FenetresSuspension
        compte={cible}
        fenetre={fenetre === "role" ? null : fenetre}
        onFenetreChange={setFenetre}
        onTermine={() => charger(recherche, filtre, page)}
        retourFocus={() => document.querySelector<HTMLElement>(`[data-actions-compte="${cible.id}"]`)}
      />
      <FenetreRole
        compte={cible}
        ouverte={fenetre === "role"}
        onOuverteChange={(ouverte) => setFenetre(ouverte ? "role" : null)}
        onTermine={() => charger(recherche, filtre, page)}
        retourFocus={() => document.querySelector<HTMLElement>(`[data-actions-compte="${cible.id}"]`)}
      />
    </div>
  );
}
