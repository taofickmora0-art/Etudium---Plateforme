"use client";

import { useRef, useState, type ReactNode } from "react";
import { SquareLock02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { useMaintenant } from "@/components/notifications/horloge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading, Lead } from "@/components/ui/Text";
import { chargerFil } from "@/lib/communaute/actions";
import { curseur } from "@/lib/communaute/regles";
import type { Curseur, Espace, LotPublications, MoiCommunaute } from "@/lib/communaute/types";
import { CartePublication } from "./CartePublication";
import { ChampPublication } from "./ChampPublication";
import { EspaceVerrouille } from "./EspaceVerrouille";

const GENERAL: Espace = { id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true };
const ECHEC = "Les publications n’ont pas pu être chargées. Réessayez.";
const valeur = (e: Espace) => e.id ?? "tous";

/**
 * La page Communauté (design NdCommunaute ; spec, §3) : les onglets d'espaces (Général = le fil de tous les espaces
 * ouverts au compte, puis un par parcours, un cadenas sur ceux qui lui sont fermés), le champ de publication, le fil
 * et « Voir plus », la colonne de droite.
 */
export function PageCommunaute({
  espaces,
  initial,
  moi,
  colonne,
  analyseActive = false,
  maintenant: heureServeur,
}: {
  espaces: Espace[];
  initial: LotPublications;
  moi: MoiCommunaute;
  colonne?: ReactNode;
  /** Migration 0020 : la mention du champ de publication. */
  analyseActive?: boolean;
  maintenant?: string;
}) {
  const liste = espaces.length > 0 ? espaces : [GENERAL];
  const [onglet, setOnglet] = useState("tous");
  const [lot, setLot] = useState(initial);
  const [chargement, setChargement] = useState(false);
  const [suite, setSuite] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Seule la dernière lecture compte : un onglet changé deux fois de suite ne mélange pas les réponses.
  const demande = useRef(0);
  const maintenant = useMaintenant(heureServeur);
  const espace = liste.find((e) => valeur(e) === onglet) ?? liste[0];

  async function lire(cible: string, depuis: Curseur | null) {
    const numero = ++demande.current;
    const reponse = await chargerFil(cible, depuis).catch(() => ({ ok: false as const, message: ECHEC }));
    if (numero !== demande.current) return null;
    if (!reponse.ok) {
      setErreur(reponse.message);
      return null;
    }
    setErreur(null);
    return reponse.lot;
  }

  async function changerOnglet(cible: string) {
    setOnglet(cible);
    setErreur(null);
    const choisi = liste.find((e) => valeur(e) === cible);
    if (!choisi?.ouvert) {
      // Un espace fermé n'a pas de fil : une lecture en cours pour un autre onglet est oubliée.
      demande.current += 1;
      setChargement(false);
      return;
    }
    setLot({ publications: [], suite: false });
    setChargement(true);
    const nouveau = await lire(cible, null);
    if (nouveau) setLot(nouveau);
    setChargement(false);
  }

  async function voirPlus() {
    const derniere = lot.publications.at(-1);
    if (!derniere) return;
    setSuite(true);
    const nouveau = await lire(onglet, curseur(derniere));
    setSuite(false);
    if (nouveau) {
      setLot((actuel) => ({
        publications: [...actuel.publications, ...nouveau.publications.filter((p) => !actuel.publications.some((a) => a.id === p.id))],
        suite: nouveau.suite,
      }));
    }
  }

  return (
    <div className="flex min-w-0 flex-col">
      <Heading level="page">Communauté</Heading>
      <Lead className="mt-2.5">Posez vos questions, partagez vos réussites, entraidez-vous.</Lead>
      <FilterChips
        className="mt-[21px]"
        label="Choisir un espace"
        options={liste.map((e) => ({
          value: valeur(e),
          label: e.nomCourt,
          icon: e.ouvert ? undefined : SquareLock02Icon,
          ariaLabel: e.ouvert ? undefined : `${e.nomCourt}, espace verrouillé`,
        }))}
        value={onglet}
        onValueChange={(cible) => void changerOnglet(cible)}
      />
      <div className="mt-5 h-px bg-separateur" />
      <div className="mt-8 flex min-w-0 flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {!espace.ouvert ? (
            <EspaceVerrouille espace={espace} />
          ) : (
            <>
              <ChampPublication
                espace={espace}
                moi={moi}
                analyseActive={analyseActive}
                onPubliee={(p) => setLot((actuel) => ({ ...actuel, publications: [p, ...actuel.publications] }))}
              />
              {erreur && <Banner tone="erreur" title={erreur} />}
              {chargement ? (
                <>
                  <Skeleton className="h-40 rounded-2xl" />
                  <Skeleton className="h-40 rounded-2xl" />
                </>
              ) : lot.publications.length === 0 ? (
                !erreur && (
                  <EmptyState
                    icon={UserGroupIcon}
                    title="Aucune publication pour l’instant"
                    description="Lancez la conversation : posez une question ou partagez une réussite."
                  />
                )
              ) : (
                lot.publications.map((p) => (
                  <CartePublication
                    key={`${onglet}-${p.id}`}
                    publication={p}
                    moi={moi}
                    maintenant={maintenant}
                    onSupprimee={(id) => setLot((actuel) => ({ ...actuel, publications: actuel.publications.filter((x) => x.id !== id) }))}
                  />
                ))
              )}
              {!chargement && lot.suite && (
                <Button variant="contour" className="self-center" loading={suite} onClick={() => void voirPlus()}>
                  Voir plus
                </Button>
              )}
            </>
          )}
        </div>
        {colonne && <aside className="min-w-0 xl:w-[320px] xl:flex-none">{colonne}</aside>}
      </div>
    </div>
  );
}
