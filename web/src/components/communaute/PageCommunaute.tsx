"use client";

import { useRef, useState, type ReactNode } from "react";
import { Bookmark02Icon, SquareLock02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { useMaintenant } from "@/components/notifications/horloge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading, Lead } from "@/components/ui/Text";
import { chargerFil } from "@/lib/communaute/actions";
import { curseur } from "@/lib/communaute/regles";
import type { Annonce, Espace, LotPublications, MoiCommunaute, SuiteFil, TriFil } from "@/lib/communaute/types";
import { CarteAnnonce } from "./CarteAnnonce";
import { CartePublication } from "./CartePublication";
import { ChampPublication } from "./ChampPublication";
import { EspaceVerrouille } from "./EspaceVerrouille";
import { MenuTri } from "./MenuTri";

const GENERAL: Espace = { id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true };
const ECHEC = "Les publications n’ont pas pu être chargées. Réessayez.";
const VIDE: LotPublications = { publications: [], suite: false };
/** Le fil « Actualités » : tous les espaces ouverts au compte. */
const ACTUALITES = "tous";
const valeur = (e: Espace) => e.id ?? "general";

/**
 * La page Communauté (design NdCommunaute ; spec du fil « Actualités », §1 à §4) : les onglets (Actualités = le fil de
 * tous les espaces ouverts au compte, Général, puis un par parcours, un cadenas sur ceux qui lui sont fermés), l'annonce
 * épinglée en tête des Actualités, le champ de publication, « Trier par : », le fil et « Voir plus », la colonne de droite.
 */
export function PageCommunaute({
  espaces,
  initial,
  moi,
  colonne,
  ongletInitial = ACTUALITES,
  annonce = null,
  analyseActive = false,
  maintenant: heureServeur,
}: {
  espaces: Espace[];
  initial: LotPublications;
  moi: MoiCommunaute;
  colonne?: ReactNode;
  /** L'onglet ouvert d'abord (`?espace=`) : « tous », « general » ou l'identifiant d'un parcours. */
  ongletInitial?: string;
  /** Migration 0021 : l'annonce que voit le compte, ou null. */
  annonce?: Annonce | null;
  /** Migration 0020 : la mention du champ de publication. */
  analyseActive?: boolean;
  maintenant?: string;
}) {
  const liste = espaces.length > 0 ? espaces : [GENERAL];
  const general = liste.find((e) => e.id === null) ?? GENERAL;
  const [onglet, setOnglet] = useState(() => (liste.some((e) => valeur(e) === ongletInitial) ? ongletInitial : ACTUALITES));
  const [tri, setTri] = useState<TriFil>("recentes");
  const [lot, setLot] = useState(initial);
  // Les pages déjà lues, pour « Voir plus » des tris par page (populaires, enregistrées).
  const [page, setPage] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [suite, setSuite] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Seule la dernière lecture compte : un onglet ou un tri changé deux fois de suite ne mélange pas les réponses.
  const demande = useRef(0);
  const maintenant = useMaintenant(heureServeur);
  const espace = onglet === ACTUALITES ? general : (liste.find((e) => valeur(e) === onglet) ?? general);

  async function lire(cible: string, ordre: TriFil, depuis: SuiteFil) {
    const numero = ++demande.current;
    const reponse = await chargerFil(cible, ordre, depuis).catch(() => ({ ok: false as const, message: ECHEC }));
    return numero === demande.current ? reponse : null;
  }

  async function recharger(cible: string, ordre: TriFil) {
    setErreur(null);
    setLot(VIDE);
    setPage(0);
    setSuite(false);
    setChargement(true);
    const reponse = await lire(cible, ordre, {});
    if (!reponse) return;
    setChargement(false);
    if (reponse.ok) setLot(reponse.lot);
    else setErreur(reponse.message);
  }

  function changerOnglet(cible: string) {
    setOnglet(cible);
    // L'adresse suit l'onglet (le menu ≡ le marque, un lien copié le rouvre) ; Next garde son routeur à jour.
    window.history.replaceState(null, "", cible === ACTUALITES ? "/communaute" : `/communaute?espace=${encodeURIComponent(cible)}`);
    const choisi = cible === ACTUALITES ? general : liste.find((e) => valeur(e) === cible);
    if (!choisi?.ouvert) {
      // Un espace fermé n'a pas de fil : une lecture en cours pour un autre onglet est oubliée.
      demande.current += 1;
      setErreur(null);
      setChargement(false);
      setSuite(false);
      return;
    }
    void recharger(cible, tri);
  }

  function changerTri(ordre: TriFil) {
    setTri(ordre);
    void recharger(onglet, ordre);
  }

  async function voirPlus() {
    const derniere = lot.publications.at(-1);
    if (!derniere) return;
    const suivante = page + 1;
    setSuite(true);
    const reponse = await lire(onglet, tri, tri === "recentes" ? { curseur: curseur(derniere) } : { page: suivante });
    if (!reponse) return;
    setSuite(false);
    if (!reponse.ok) {
      setErreur(reponse.message);
      return;
    }
    setErreur(null);
    setPage(suivante);
    setLot((actuel) => ({
      publications: [...actuel.publications, ...reponse.lot.publications.filter((p) => !actuel.publications.some((a) => a.id === p.id))],
      suite: reponse.lot.suite,
    }));
  }

  return (
    <div className="flex min-w-0 flex-col">
      <Heading level="page">Communauté</Heading>
      <Lead className="mt-2.5">Posez vos questions, partagez vos réussites, entraidez-vous.</Lead>
      <FilterChips
        // Sur téléphone, les onglets défilent en largeur (spec du fil « Actualités », §1).
        className="mt-[21px] max-sm:-my-1 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-0.5 max-sm:py-1 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden"
        label="Choisir un espace"
        options={[
          { value: ACTUALITES, label: "Actualités" },
          ...liste.map((e) => ({
            value: valeur(e),
            label: e.nomCourt,
            icon: e.ouvert ? undefined : SquareLock02Icon,
            ariaLabel: e.ouvert ? undefined : `${e.nomCourt}, espace verrouillé`,
          })),
        ]}
        value={onglet}
        onValueChange={changerOnglet}
      />
      <div className="mt-5 h-px bg-separateur" />
      <div className="mt-7 flex min-w-0 flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {!espace.ouvert ? (
            <EspaceVerrouille espace={espace} />
          ) : (
            <>
              {onglet === ACTUALITES && annonce && <CarteAnnonce annonce={annonce} equipe={moi.equipe === true} />}
              <ChampPublication
                key={valeur(espace)}
                espace={espace}
                moi={moi}
                analyseActive={analyseActive}
                // Une nouvelle publication n'est pas encore dans « Mes enregistrements ».
                onPubliee={(p) => tri !== "enregistrees" && setLot((actuel) => ({ ...actuel, publications: [p, ...actuel.publications] }))}
              />
              <MenuTri valeur={tri} onChange={changerTri} />
              {erreur && <Banner tone="erreur" title={erreur} />}
              {chargement ? (
                <>
                  <Skeleton className="h-40 rounded-2xl" />
                  <Skeleton className="h-40 rounded-2xl" />
                </>
              ) : lot.publications.length === 0 ? (
                !erreur &&
                (tri === "enregistrees" ? (
                  <EmptyState icon={Bookmark02Icon} title="Aucune publication enregistrée" description="Touchez le signet d’une publication pour la retrouver ici." />
                ) : (
                  <EmptyState icon={UserGroupIcon} title="Aucune publication pour l’instant" description="Lancez la conversation : posez une question ou partagez une réussite." />
                ))
              ) : (
                lot.publications.map((p) => (
                  <CartePublication
                    key={`${onglet}-${tri}-${p.id}`}
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
        {colonne && <div className="min-w-0 xl:w-[320px] xl:flex-none">{colonne}</div>}
      </div>
    </div>
  );
}
