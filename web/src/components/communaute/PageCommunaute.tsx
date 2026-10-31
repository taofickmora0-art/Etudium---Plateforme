"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Bookmark02Icon, CalendarClockIcon, SquareLock02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { useMaintenant } from "@/components/notifications/horloge";
import { CarteNouvelleFormation } from "@/components/accueil/CarteNouvelleFormation";
import { FormationsDisponibles } from "@/components/accueil/FormationsDisponibles";
import { BoutonSessionsProgrammees } from "@/components/sessions/BoutonSessionsProgrammees";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading, Lead } from "@/components/ui/Text";
import { useToast } from "@/components/ui/Toast";
import { entrelacer, type ElementFil } from "@/lib/accueil/fil";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import { chargerFil, masquerAnnonce } from "@/lib/communaute/actions";
import { CHEMINS_COMMUNAUTE, type EspaceCommunaute } from "@/lib/communaute/chemins";
import { curseur } from "@/lib/communaute/regles";
import type { Annonce, Espace, LotPublications, MoiCommunaute, SuiteFil, TriFil } from "@/lib/communaute/types";
import { BandeauNouvellesPublications } from "./BandeauNouvellesPublications";
import { CarteAnnonce } from "./CarteAnnonce";
import { CartePublication } from "./CartePublication";
import { ChampPublication } from "./ChampPublication";
import { EspaceVerrouille } from "./EspaceVerrouille";
import { MenuTri } from "./MenuTri";
import { useNouvellesPublications } from "./useNouvellesPublications";

const GENERAL: Espace = { id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true };
const ECHEC = "Les publications n’ont pas pu être chargées. Réessayez.";
const VIDE: LotPublications = { publications: [], suite: false };
/** Le fil « Actualités » : tous les espaces ouverts au compte. */
const ACTUALITES = "tous";
const valeur = (e: Espace) => e.id ?? "general";
const INTRO = "Les dernières nouvelles d’Étudium : publications, nouvelles formations et sessions live.";
/** Sous le champ : le fil des publications parues, ou les siennes programmées (spec sondages, quiz et programmation, §5). */
type Vue = "publiees" | "programmees";

/**
 * L'Accueil, qui est la communauté (spec du nouvel Accueil ; design NdCommunaute ; spec du fil « Actualités », §1 à §4) : les onglets (Actualités = le fil de
 * tous les espaces ouverts au compte, Général, puis un par parcours, un cadenas sur ceux qui lui sont fermés), l'annonce
 * épinglée en tête des Actualités, le champ de publication, « Trier par : », le fil et « Voir plus », la colonne de droite.
 * Dans Actualités, « Les plus récentes », les nouvelles formations se glissent à leur date ; sous le fil, « Formations
 * disponibles ».
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
  sessionsAVenir = false,
  titre = "Accueil",
  intro = INTRO,
  nouvelles = [],
  disponibles = [],
  espace: espaceCompte = "etudiant",
  programmees: programmeesInitiales = [],
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
  /** Une session live est à venir : le bouton « Sessions live programmées » (spec promotion des sessions live, §3). */
  sessionsAVenir?: boolean;
  /** L'en-tête : « Bonjour, Koffi ». */
  titre?: string;
  intro?: string;
  /** Les formations mises en ligne depuis 30 jours, glissées dans le fil (spec du nouvel Accueil, §2). */
  nouvelles?: CarteCatalogue[];
  /** « Formations disponibles » sous le fil (§3). */
  disponibles?: CarteCatalogue[];
  /** L'espace qui l'affiche : ses adresses (restructuration R1 : la communauté du formateur). */
  espace?: EspaceCommunaute;
  /** Ses publications programmées (tous les espaces) : la pastille de « Programmées » compte celles encore à venir. */
  programmees?: { id: string; creeLe: string }[];
}) {
  const liste = espaces.length > 0 ? espaces : [GENERAL];
  const general = liste.find((e) => e.id === null) ?? GENERAL;
  const [onglet, setOnglet] = useState(() => (liste.some((e) => valeur(e) === ongletInitial) ? ongletInitial : ACTUALITES));
  const [tri, setTri] = useState<TriFil>("recentes");
  const [vue, setVue] = useState<Vue>("publiees");
  // Radix annonce le même onglet à l'appui puis au focus, avant le rendu : la vue courante, tenue à jour sans attendre.
  const vueCourante = useRef<Vue>("publiees");
  // Ce que lit le fil : le tri choisi, ou les programmées du compte.
  const ordre: TriFil = vue === "programmees" ? "programmees" : tri;
  const [lot, setLot] = useState(initial);
  // Les pages déjà lues, pour « Voir plus » des tris par page (populaires, enregistrées).
  const [page, setPage] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [suite, setSuite] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Seule la dernière lecture compte : un onglet ou un tri changé deux fois de suite ne mélange pas les réponses.
  const demande = useRef(0);
  const maintenant = useMaintenant(heureServeur);
  const { toast } = useToast();
  // L'annonce masquée par le compte (0039) : elle disparaît aussitôt ; un refus la fait revenir.
  const [annonceMasquee, setAnnonceMasquee] = useState(false);
  async function masquer() {
    setAnnonceMasquee(true);
    const reponse = await masquerAnnonce().catch(() => ({ ok: false as const, message: "L’opération n’a pas abouti. Réessayez." }));
    if (!reponse.ok) {
      setAnnonceMasquee(false);
      toast({ tone: "erreur", title: reponse.message });
    }
  }
  // Ses programmées encore à venir (demande du 31 octobre 2026) : une qui paraît quitte le compte à l'heure dite.
  const [programmees, setProgrammees] = useState(programmeesInitiales);
  const aVenir = programmees.filter((p) => new Date(p.creeLe) > maintenant).length;
  const espace = onglet === ACTUALITES ? general : (liste.find((e) => valeur(e) === onglet) ?? general);
  // L'onglet suit l'adresse : une entrée du menu ≡ (`?espace=`) ouvre le sien, sans recharger la page. L'adresse que la
  // page écrit elle-même (`replaceState`) est notée d'avance et ne relit rien ; une relecture du serveur garde tout.
  const demandee = useSearchParams()?.get("espace") ?? ACTUALITES;
  // L'Accueil de l'étudiant, ou la communauté du formateur (restructuration R1).
  const racine = CHEMINS_COMMUNAUTE[espaceCompte].accueil;
  const adresse = useRef(demandee);
  // Le bandeau « Nouvelles publications » (liste du 31 octobre 2026, tâche 9) : seulement sous « Les plus récentes »,
  // repéré sur la plus récente du fil affiché (null : fil vide, tout ce qui paraît est nouveau).
  const filRef = useRef<HTMLDivElement>(null);
  const repere = lot.publications.reduce<string | null>((max, p) => (max === null || Date.parse(p.creeLe) > Date.parse(max) ? p.creeLe : max), null);
  const { nouvelles: parues, effacer } = useNouvellesPublications(onglet, repere, espace.ouvert && ordre === "recentes" && !chargement && !erreur);

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
    if (!reponse.ok) return setErreur(reponse.message);
    setLot(reponse.lot);
    // Les programmées de tous les espaces viennent d'être lues : la pastille suit.
    if (ordre === "programmees" && cible === ACTUALITES) setProgrammees(reponse.lot.publications.map(({ id, creeLe }) => ({ id, creeLe })));
  }

  function changerOnglet(cible: string, ecrireAdresse = true) {
    setOnglet(cible);
    if (ecrireAdresse) {
      // L'adresse suit l'onglet (le menu ≡ le marque, un lien copié le rouvre) ; Next garde son routeur à jour.
      adresse.current = cible;
      window.history.replaceState(null, "", cible === ACTUALITES ? racine : `${racine}?espace=${encodeURIComponent(cible)}`);
    }
    const choisi = cible === ACTUALITES ? general : liste.find((e) => valeur(e) === cible);
    if (!choisi?.ouvert) {
      // Un espace fermé n'a pas de fil : une lecture en cours pour un autre onglet est oubliée.
      demande.current += 1;
      setErreur(null);
      setChargement(false);
      setSuite(false);
      return;
    }
    void recharger(cible, ordre);
  }

  const suivreAdresse = useEffectEvent((cible: string) => {
    if (cible !== onglet && (cible === ACTUALITES || liste.some((e) => valeur(e) === cible))) changerOnglet(cible, false);
  });
  useEffect(() => {
    if (demandee === adresse.current) return;
    adresse.current = demandee;
    suivreAdresse(demandee);
  }, [demandee]);

  function changerTri(nouveau: TriFil) {
    setTri(nouveau);
    void recharger(onglet, nouveau);
  }

  function changerVue(nouvelle: Vue) {
    if (nouvelle === vueCourante.current) return;
    vueCourante.current = nouvelle;
    setVue(nouvelle);
    void recharger(onglet, nouvelle === "programmees" ? "programmees" : tri);
  }

  const retirer = (id: string) => {
    setLot((actuel) => ({ ...actuel, publications: actuel.publications.filter((x) => x.id !== id) }));
    setProgrammees((actuelles) => actuelles.filter((p) => p.id !== id));
  };

  /** Relit ses programmées (tous les espaces), pour la pastille ; un échec ne change rien. */
  async function relireProgrammees() {
    const reponse = await chargerFil(ACTUALITES, "programmees", {}).catch(() => null);
    if (reponse?.ok) setProgrammees(reponse.lot.publications.map(({ id, creeLe }) => ({ id, creeLe })));
  }

  /** Le bandeau touché : le fil relu, sans squelette ; on remonte en haut du fil si l'on était descendu. */
  async function actualiser() {
    effacer();
    const reponse = await lire(onglet, "recentes", {});
    if (!reponse) return;
    if (!reponse.ok) {
      toast({ tone: "erreur", title: reponse.message });
      return;
    }
    setErreur(null);
    setPage(0);
    setLot(reponse.lot);
    const fil = filRef.current;
    const entete = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--entete-app")) || 0;
    if (fil && fil.getBoundingClientRect().top < entete) fil.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function voirPlus() {
    const derniere = lot.publications.at(-1);
    if (!derniere) return;
    const suivante = page + 1;
    setSuite(true);
    const reponse = await lire(onglet, ordre, ordre === "recentes" ? { curseur: curseur(derniere) } : { page: suivante });
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

  // Les nouvelles formations, dans Actualités et « Les plus récentes » seulement.
  const elements: ElementFil[] =
    onglet === ACTUALITES && ordre === "recentes"
      ? entrelacer(lot.publications, nouvelles, !lot.suite)
      : lot.publications.map((publication) => ({ type: "publication", publication }));

  // Le fil : le même sous les deux onglets, lu selon `ordre`.
  const filAffiche = (
    <div ref={filRef} className="flex min-w-0 scroll-mt-[calc(var(--entete-app)+16px)] flex-col gap-4">
      {erreur && <Banner tone="erreur" title={erreur} />}
      {chargement ? (
        <>
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </>
      ) : elements.length === 0 ? (
        !erreur &&
        (vue === "programmees" ? (
          <EmptyState
            icon={CalendarClockIcon}
            title="Aucune publication programmée"
            description="Avec la flèche à côté de « Publier », choisissez le jour et l’heure où une publication paraîtra."
          />
        ) : tri === "enregistrees" ? (
          <EmptyState icon={Bookmark02Icon} title="Aucune publication enregistrée" description="Touchez le signet d’une publication pour la retrouver ici." />
        ) : (
          <EmptyState icon={UserGroupIcon} title="Aucune publication pour l’instant" description="Lancez la conversation : posez une question ou partagez une réussite." />
        ))
      ) : (
        elements.map((e) =>
          e.type === "formation" ? (
            <CarteNouvelleFormation key={`formation-${e.formation.id}`} formation={e.formation} maintenant={maintenant} />
          ) : (
            <CartePublication
              key={`${onglet}-${ordre}-${e.publication.id}`}
              publication={e.publication}
              moi={moi}
              maintenant={maintenant}
              onSupprimee={retirer}
              onParue={vue === "programmees" ? retirer : undefined}
              lienSession={CHEMINS_COMMUNAUTE[espaceCompte].evenements}
            />
          ),
        )
      )}
      {!chargement && lot.suite && (
        <Button variant="contour" className="self-center" loading={suite} onClick={() => void voirPlus()}>
          Voir plus
        </Button>
      )}
    </div>
  );

  return (
    // Le fil (720 px) et sa colonne (320 px) restent au milieu de l'écran, l'en-tête aligné sur eux.
    <div className="mx-auto flex w-full max-w-[720px] min-w-0 flex-col xl:max-w-[1064px]">
      {/* Tout en haut de la page, sous la barre du haut, où que l'on soit dans le fil (demande du 31 octobre 2026). */}
      <BandeauNouvellesPublications nouvelles={parues} onVoir={() => void actualiser()} />
      <Heading level="page">{titre}</Heading>
      <Lead className="mt-2.5">{intro}</Lead>
      {/* Les espaces, et à droite (dessous sur téléphone) « Sessions live programmées » s'il y en a une à venir. */}
      <div className="mt-[21px] flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 max-sm:mt-4">
        <FilterChips
          // Sur téléphone, les onglets défilent en largeur (spec du fil « Actualités », §1).
          className="min-w-0 max-sm:-mb-1 max-sm:w-full max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-0.5 max-sm:py-1 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden"
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
          onValueChange={(cible) => changerOnglet(cible)}
        />
        {sessionsAVenir && <BoutonSessionsProgrammees />}
      </div>
      <div className="mt-5 h-px bg-separateur" />
      <div className="mt-7 flex min-w-0 flex-col gap-6 xl:flex-row xl:items-start">
        {/* Sur ordinateur, une largeur fixe : les vidéos et les images ne grandissent pas avec l'écran. */}
        <div className="flex w-full max-w-[720px] min-w-0 flex-1 flex-col gap-4">
          {!espace.ouvert ? (
            <EspaceVerrouille espace={espace} espaceCompte={espaceCompte} />
          ) : (
            <>
              {onglet === ACTUALITES && annonce && !annonceMasquee && <CarteAnnonce annonce={annonce} equipe={moi.equipe === true} onMasquer={() => void masquer()} />}
              <ChampPublication
                key={onglet}
                espace={espace}
                espaces={liste.filter((e) => e.ouvert)}
                moi={moi}
                analyseActive={analyseActive}
                // Une nouvelle publication s'ajoute au fil affiché s'il la contient (pas « Mes enregistrements », ni un autre espace).
                onPubliee={(p) => {
                  if (vue === "programmees" || tri === "enregistrees" || (onglet !== ACTUALITES && (p.espace.id ?? "general") !== onglet)) return false;
                  setLot((actuel) => ({ ...actuel, publications: [p, ...actuel.publications] }));
                  return true;
                }}
                onProgrammee={() => {
                  if (vue === "programmees") void recharger(onglet, "programmees");
                  // La pastille : relue si la liste affichée n'est pas celle de tous les espaces.
                  if (vue !== "programmees" || onglet !== ACTUALITES) void relireProgrammees();
                }}
              />
              <SegmentedTabs
                label="Afficher les publications"
                value={vue}
                onValueChange={(v) => changerVue(v as Vue)}
                className="gap-4 border-t border-bordure-carte pt-3"
                aCote={vue === "publiees" ? <MenuTri valeur={tri} onChange={changerTri} /> : null}
                items={[
                  { value: "publiees", label: "Publiées", content: filAffiche },
                  {
                    value: "programmees",
                    label: "Programmées",
                    content: filAffiche,
                    pastille: { nombre: aVenir, libelle: `${aVenir} publication${aVenir > 1 ? "s" : ""} programmée${aVenir > 1 ? "s" : ""}` },
                  },
                ]}
              />
              <FormationsDisponibles cartes={disponibles} />
            </>
          )}
        </div>
        {colonne && <div className="min-w-0 xl:w-[320px] xl:flex-none">{colonne}</div>}
      </div>
    </div>
  );
}
