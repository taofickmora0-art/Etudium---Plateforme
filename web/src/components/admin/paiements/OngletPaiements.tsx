"use client";

import { useRef, useState, useTransition } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { Tag } from "@/components/ui/Tag";
import { chargerPaiements } from "@/lib/admin/paiements/actions";
import { PAIEMENTS_PAR_PAGE, type PagePaiements } from "@/lib/admin/paiements/data";
import { dureeAbonnement, libelleMoyen, libelleStatut, montantFcfa } from "@/lib/abonnement/regles";
import { dateNumerique } from "@/lib/utilisateurs/regles";
import { DetailPaiement } from "./DetailPaiement";

const FILTRES = [
  { value: "tous", label: "Tous" },
  { value: "reussi", label: "Réussis" },
  { value: "en_attente", label: "En attente" },
  { value: "echoue", label: "Échoués" },
  { value: "expire", label: "Expirés" },
];
const COLONNES = ["Date", "Compte", "Abonnement", "Opérateur", "Montant", "Statut"];
const DELAI_RECHERCHE_MS = 300;

/** L'onglet « Paiements » : filtre par état, recherche par compte ou numéro de reçu, détail d'un paiement. */
export function OngletPaiements({ initial, ecriture }: { initial: PagePaiements; ecriture: boolean }) {
  const [filtre, setFiltre] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [chargement, demarrer] = useTransition();
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const derniere = useRef(0);

  const charger = (q: string, f: string, p: number) => {
    if (minuterie.current) clearTimeout(minuterie.current);
    const numero = ++derniere.current;
    setPage(p);
    demarrer(async () => {
      const r = await chargerPaiements({ statut: f === "tous" ? null : f, recherche: q, page: p });
      if (numero !== derniere.current) return;
      if (r.ok) {
        setDonnees(r.page);
        setErreur(null);
      } else setErreur(r.message);
    });
  };

  const pages = Math.ceil(donnees.total / PAIEMENTS_PAR_PAGE);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Filtrer les paiements"
          options={FILTRES}
          value={filtre}
          onValueChange={(v) => {
            setFiltre(v);
            charger(recherche, v, 1);
          }}
        />
        <form
          role="search"
          className="min-w-0 flex-[0_1_320px]"
          onSubmit={(e) => {
            e.preventDefault();
            charger(recherche, filtre, 1);
          }}
        >
          <SearchInput
            aria-label="Rechercher un compte ou un numéro de reçu"
            placeholder="Rechercher un compte ou un reçu…"
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
      {erreur && <Banner tone="erreur" title={erreur} />}
      {donnees.lignes.length === 0 ? (
        <p className="m-0 text-sm leading-[22px] text-discret">Aucun paiement ne correspond.</p>
      ) : (
        <TableauListe nom="Paiements" nomCadre="Tableau des paiements" colonnes={COLONNES} actions occupe={chargement}>
          {donnees.lignes.map((l) => {
            const statut = libelleStatut(l.statut);
            const nom = `${l.compte.prenom} ${l.compte.nom}`.trim() || "Sans nom";
            return (
              <tr key={l.id}>
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{dateNumerique(l.creeLe)}</td>
                <td className={CELLULE_TABLEAU}>
                  <span className="block font-medium text-encre">{nom}</span>
                  <span className="block text-xs leading-[18px] text-discret">{l.compte.email}</span>
                </td>
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{`${l.formule.nom} · ${dureeAbonnement(l.formule.dureeMois)}`}</td>
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{libelleMoyen(l)}</td>
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{montantFcfa(l.montant)}</td>
                <td className={CELLULE_TABLEAU}>
                  <Tag tone={statut.ton}>{statut.libelle}</Tag>
                </td>
                <td className={CELLULE_TABLEAU}>
                  <Button variant="discret" size="sm" aria-label="Voir le détail" onClick={() => setDetail(l.id)}>
                    Détail
                  </Button>
                </td>
              </tr>
            );
          })}
        </TableauListe>
      )}
      {pages > 1 && <Pagination page={page} pageCount={pages} onPageChange={(p) => charger(recherche, filtre, p)} label="Pages des paiements" />}
      {detail && <DetailPaiement id={detail} ecriture={ecriture} onFermer={() => setDetail(null)} />}
    </div>
  );
}
