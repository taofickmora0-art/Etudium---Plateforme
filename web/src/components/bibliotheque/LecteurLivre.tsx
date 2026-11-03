"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type TouchEvent } from "react";
import Link from "next/link";
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  LeftToRightListBulletIcon,
  MinusSignIcon,
  Moon02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { Dialog as RadixDialog } from "radix-ui";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { PagePdf } from "@/components/lecon/VisualiseurRessource";
import { creerEnregistreur, DELAI_ENREGISTREMENT, type Enregistreur } from "@/lib/bibliotheque/enregistreur";
import { lienLectureLivre, noterLecture } from "@/lib/bibliotheque/lecteur";
import { adresseLivre, CRANS_ZOOM, ZOOM_MAX, ZOOM_MIN, zoomApresPincement } from "@/lib/bibliotheque/regles";
import { cn } from "@/lib/cn";
import { ouvrirPdf, type DocumentPdf, type EntreeSommaire } from "@/lib/ressources/pdf";
import { BoutonTelechargerLivre } from "./BoutonTelechargerLivre";

type Props = {
  livre: { id: string; slug: string; titre: string; telechargeable: boolean };
  /** La page où ouvrir le livre : la dernière lue, ou celle de l'adresse (« Relire » : la première). */
  pageDepart: number;
  /** Remplacent pdf.js, les actions serveur et le délai d'enregistrement (tests). */
  ouvrir?: typeof ouvrirPdf;
  lien?: typeof lienLectureLivre;
  noter?: typeof noterLecture;
  delai?: number;
};

type Etat = { type: "chargement" } | { type: "erreur"; message: string } | { type: "pdf"; document: DocumentPdf };

const ECHEC = "Ce livre n’a pas pu être affiché.";
/** Largeur de lecture : la page tient l'écran du téléphone ; sur ordinateur, elle s'arrête à une largeur confortable. */
const LARGEUR_MAX = 860;
const LARGEUR_PAR_DEFAUT = 800;
/** La page affichée est celle qui occupe le haut de la zone (son début est passé au-dessus du tiers de la hauteur). */
const REPERE = 0.35;

// ─── Le mode nuit : un choix gardé dans le navigateur, d'un livre à l'autre ─────────────────────────
const CLE_NUIT = "etudium-lecteur-nuit";
const abonnesNuit = new Set<() => void>();
function lireNuit(): boolean {
  try {
    return window.localStorage.getItem(CLE_NUIT) === "1";
  } catch {
    return false;
  }
}
function ecrireNuit(nuit: boolean) {
  try {
    if (nuit) window.localStorage.setItem(CLE_NUIT, "1");
    else window.localStorage.removeItem(CLE_NUIT);
  } catch {
    // Stockage refusé (navigation privée) : le choix vaut pour cette visite seulement.
  }
  for (const prevenir of abonnesNuit) prevenir();
}
function abonnerNuit(prevenir: () => void) {
  abonnesNuit.add(prevenir);
  window.addEventListener("storage", prevenir);
  return () => {
    abonnesNuit.delete(prevenir);
    window.removeEventListener("storage", prevenir);
  };
}

const OUTIL =
  "focus-etudium flex size-9 flex-none cursor-pointer items-center justify-center rounded-puce transition-colors disabled:cursor-not-allowed disabled:opacity-45";

/** Le sommaire du PDF, imbriqué : chaque entrée qui a une page y mène. */
function ListeSommaire({ entrees, choisir, niveau = 0 }: { entrees: EntreeSommaire[]; choisir: (page: number) => void; niveau?: number }) {
  return (
    <ul className={cn("m-0 flex list-none flex-col p-0", niveau > 0 && "mt-0.5 border-l border-bordure-carte pl-3")}>
      {entrees.map((e, i) => (
        <li key={`${niveau}-${i}-${e.titre}`} className="min-w-0">
          {e.page ? (
            <button
              type="button"
              onClick={() => choisir(e.page!)}
              className={cn(
                "focus-etudium flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-champ px-2.5 py-2 text-left text-sm leading-5 text-encre transition-colors hover:bg-page",
                niveau === 0 && "font-medium",
              )}
            >
              <span className="min-w-0 wrap-anywhere">{e.titre}</span>
              <span className="flex-none text-xs text-discret tabular-nums">{e.page}</span>
            </button>
          ) : (
            <span className="block px-2.5 py-2 text-sm leading-5 font-medium text-discret">{e.titre}</span>
          )}
          {e.enfants.length > 0 && <ListeSommaire entrees={e.enfants} choisir={choisir} niveau={niveau + 1} />}
        </li>
      ))}
    </ul>
  );
}

/**
 * Le lecteur d'un livre (spec du 3 novembre 2026, §2 et §4) : plein écran, sobre. En haut, le retour à la fiche, le
 * titre, « Page N sur M », la page précédente et suivante, le zoom, le sommaire du PDF s'il en a un, le mode nuit (et
 * « Télécharger » pour un livre téléchargeable). Les pages défilent en continu, au doigt sur téléphone (pincer pour
 * zoomer) ; seules celles proches de l'écran sont dessinées. Le livre s'ouvre à la dernière page lue ; la page affichée
 * est notée (noter_lecture) au plus une fois toutes les 3 secondes, et à la fermeture.
 *
 * Le PDF est lu par un lien signé de deux minutes, téléchargé en mémoire puis dessiné par pdf.js : aucune adresse du
 * fichier dans la page, ni bouton pour l'enregistrer quand le livre n'est pas téléchargeable. Ce n'est pas une
 * protection absolue (capture d'écran), et rien ne le prétend.
 */
export function LecteurLivre({ livre, pageDepart, ouvrir = ouvrirPdf, lien = lienLectureLivre, noter = noterLecture, delai = DELAI_ENREGISTREMENT }: Props) {
  const [essai, setEssai] = useState(0);
  const [etat, setEtat] = useState<Etat>({ type: "chargement" });
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [sommaire, setSommaire] = useState<EntreeSommaire[]>([]);
  const [sommaireOuvert, setSommaireOuvert] = useState(false);
  const nuit = useSyncExternalStore(abonnerNuit, lireNuit, () => false);
  // La zone qui défile : racine de l'observation des pages, largeur de référence, page affichée.
  const [corps, setCorps] = useState<HTMLElement | null>(null);
  const [largeurCadre, setLargeurCadre] = useState(LARGEUR_PAR_DEFAUT);
  const cadres = useRef(new Map<number, HTMLDivElement>());
  const pages = useRef<HTMLDivElement>(null);
  const enregistreur = useRef<Enregistreur | null>(null);
  // Le défilement relatif à garder pendant un changement de zoom, et le pincement en cours.
  const garderDefilement = useRef<number | null>(null);
  const pincement = useRef<{ ecart: number; zoom: number; provisoire: number } | null>(null);
  const calcul = useRef<number | null>(null);

  const total = etat.type === "pdf" ? etat.document.pages : 0;
  const pageInitiale = etat.type === "pdf" ? Math.min(Math.max(Math.trunc(pageDepart) || 1, 1), etat.document.pages) : 1;

  // Le livre : lien signé, lecture du fichier en mémoire (le lien peut expirer ensuite), ouverture par pdf.js.
  useEffect(() => {
    let annule = false;
    let ouvert: DocumentPdf | null = null;
    (async () => {
      try {
        const reponse = await lien(livre.id);
        if ("erreur" in reponse) {
          if (!annule) setEtat({ type: "erreur", message: reponse.erreur });
          return;
        }
        const fichier = await fetch(reponse.url);
        if (!fichier.ok) throw new Error(`Lecture du fichier : ${fichier.status}`);
        const document = await ouvrir(await fichier.arrayBuffer());
        if (annule) return document.fermer();
        ouvert = document;
        setPage(Math.min(Math.max(Math.trunc(pageDepart) || 1, 1), document.pages));
        setEtat({ type: "pdf", document });
        const entrees = await (document.sommaire?.() ?? Promise.resolve([]));
        if (!annule) setSommaire(entrees);
      } catch {
        if (!annule) setEtat({ type: "erreur", message: ECHEC });
      }
    })();
    return () => {
      annule = true;
      ouvert?.fermer();
    };
    // pageDepart ne compte qu'à l'ouverture : la suite, c'est le lecteur qui la tient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livre.id, lien, ouvrir, essai]);

  // La reprise : la page de départ amenée en haut de l'écran, une fois les cadres des pages posés.
  useEffect(() => {
    if (etat.type === "pdf") cadres.current.get(pageInitiale)?.scrollIntoView({ block: "start" });
  }, [etat, pageInitiale]);

  // L'enregistrement de la page : créé à l'ouverture du livre, vidé à la fermeture du lecteur et quand l'onglet se cache.
  useEffect(() => {
    if (etat.type !== "pdf") return;
    const pagesDuLivre = etat.document.pages;
    const e = creerEnregistreur((p) => {
      void noter(livre.id, p, pagesDuLivre).catch(() => undefined);
    }, delai);
    enregistreur.current = e;
    const cacher = () => {
      if (document.visibilityState === "hidden") e.vider();
    };
    document.addEventListener("visibilitychange", cacher);
    window.addEventListener("pagehide", e.vider);
    return () => {
      document.removeEventListener("visibilitychange", cacher);
      window.removeEventListener("pagehide", e.vider);
      e.vider();
      enregistreur.current = null;
    };
  }, [etat, livre.id, noter, delai]);

  useEffect(() => {
    if (etat.type === "pdf") enregistreur.current?.noter(page);
  }, [etat, page]);

  // Largeur de la zone : les pages s'y ajustent, et suivent un changement de taille (rotation du téléphone).
  useEffect(() => {
    if (!corps) return;
    const mesurer = () => {
      if (corps.clientWidth <= 0) return;
      const nouvelle = Math.min(corps.clientWidth - 32, LARGEUR_MAX);
      setLargeurCadre((avant) => {
        // Une rotation du téléphone garde la même place dans le livre, comme un zoom.
        if (nouvelle !== avant && corps.scrollHeight > 0) garderDefilement.current = corps.scrollTop / corps.scrollHeight;
        return nouvelle;
      });
    };
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(corps);
    return () => observateur.disconnect();
  }, [corps]);

  const largeur = Math.round(largeurCadre * zoom);

  // Un zoom garde la même place dans le livre (le défilement relatif), pas le même nombre de pixels.
  useLayoutEffect(() => {
    if (!corps || garderDefilement.current === null) return;
    const haut = garderDefilement.current * corps.scrollHeight;
    garderDefilement.current = null;
    if (typeof corps.scrollTo === "function") corps.scrollTo({ top: haut, behavior: "instant" });
  }, [corps, largeur]);

  const surCadre = useCallback((numero: number, cadre: HTMLDivElement | null) => {
    if (cadre) cadres.current.set(numero, cadre);
    else cadres.current.delete(numero);
  }, []);

  const allerA = (numero: number) => {
    if (!total) return;
    const cible = Math.min(Math.max(numero, 1), total);
    setPage(cible);
    cadres.current.get(cible)?.scrollIntoView({ block: "start" });
  };

  const changerZoom = (suivant: number) => {
    const borne = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, suivant));
    if (borne === zoom) return;
    if (corps && corps.scrollHeight > 0) garderDefilement.current = corps.scrollTop / corps.scrollHeight;
    setZoom(borne);
  };
  const plusPetit = [...CRANS_ZOOM].reverse().find((c) => c < zoom - 0.001);
  const plusGrand = CRANS_ZOOM.find((c) => c > zoom + 0.001);

  // La page affichée suit le défilement (calculée une fois par image, pas à chaque événement).
  const suivreDefilement = () => {
    if (calcul.current !== null || !corps) return;
    calcul.current = requestAnimationFrame(() => {
      calcul.current = null;
      const repere = corps.getBoundingClientRect().top + corps.clientHeight * REPERE;
      let affichee = 1;
      for (const numero of [...cadres.current.keys()].sort((a, b) => a - b)) {
        if (cadres.current.get(numero)!.getBoundingClientRect().top <= repere) affichee = numero;
        else break;
      }
      setPage(affichee);
    });
  };
  useEffect(() => () => {
    if (calcul.current !== null) cancelAnimationFrame(calcul.current);
  }, []);

  // Le pincement à deux doigts : un aperçu (agrandissement des pages déjà dessinées), puis le zoom au lever des doigts.
  const ecartDe = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  const debutToucher = (e: TouchEvent) => {
    if (e.touches.length === 2) pincement.current = { ecart: ecartDe(e), zoom, provisoire: zoom };
  };
  const mouvementToucher = (e: TouchEvent) => {
    const p = pincement.current;
    if (!p || e.touches.length !== 2) return;
    p.provisoire = zoomApresPincement(p.zoom, p.ecart, ecartDe(e));
    if (pages.current) pages.current.style.transform = `scale(${p.provisoire / p.zoom})`;
  };
  const finToucher = (e: TouchEvent) => {
    const p = pincement.current;
    if (!p || e.touches.length >= 2) return;
    pincement.current = null;
    if (pages.current) pages.current.style.transform = "";
    changerZoom(p.provisoire);
  };

  // Au clavier, dans la zone du livre : ← et → tournent les pages (les flèches ↑ ↓ et Page suivante font défiler).
  const clavier = (e: React.KeyboardEvent) => {
    if (!corps || corps.scrollWidth > corps.clientWidth + 1) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      allerA(page + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      allerA(page - 1);
    }
  };

  const outil = cn(OUTIL, nuit ? "text-[#D7DEEC] hover:bg-white/10" : "text-texte hover:bg-coque");
  return (
    <div data-nuit={nuit ? "oui" : "non"} className={cn("flex h-dvh min-h-0 flex-col", nuit ? "bg-[#10141D]" : "bg-page")}>
      <header
        className={cn(
          "flex min-h-14 flex-none items-center gap-1.5 border-b px-2 py-1.5 sm:gap-2 sm:px-3",
          nuit ? "border-white/10 bg-[#171C27] text-[#E8ECF4]" : "border-bordure-carte bg-panneau text-encre",
        )}
      >
        <Link href={adresseLivre(livre.slug)} aria-label="Retour à la fiche" className={cn(outil, "size-10")}>
          <Icon icon={ArrowLeft01Icon} size={20} />
        </Link>
        <h1 title={livre.titre} className="m-0 min-w-0 flex-1 truncate text-[15px] leading-[22px] font-semibold max-sm:text-sm">
          {livre.titre}
        </h1>
        {etat.type === "pdf" && (
          <>
            <span aria-live="polite" aria-atomic="true" className={cn("flex-none text-[13px] leading-5 whitespace-nowrap tabular-nums", nuit ? "text-[#AEB7C8]" : "text-discret")}>
              <span aria-hidden="true" className="sm:hidden">{`${page} / ${total}`}</span>
              <span className="max-sm:sr-only">{`Page ${page} sur ${total}`}</span>
            </span>
            <div className="flex flex-none items-center gap-0.5 max-sm:hidden">
              <button type="button" aria-label="Page précédente" disabled={page <= 1} onClick={() => allerA(page - 1)} className={outil}>
                <Icon icon={ArrowUp01Icon} size={18} />
              </button>
              <button type="button" aria-label="Page suivante" disabled={page >= total} onClick={() => allerA(page + 1)} className={outil}>
                <Icon icon={ArrowDown01Icon} size={18} />
              </button>
              <span aria-hidden="true" className={cn("mx-1 h-6 w-px", nuit ? "bg-white/15" : "bg-bordure")} />
              <button type="button" aria-label="Réduire" disabled={plusPetit === undefined} onClick={() => plusPetit !== undefined && changerZoom(plusPetit)} className={outil}>
                <Icon icon={MinusSignIcon} size={18} />
              </button>
              <span aria-live="polite" className="w-12 text-center text-[13px] leading-5 font-medium tabular-nums">
                {Math.round(zoom * 100)} %
              </span>
              <button type="button" aria-label="Agrandir" disabled={plusGrand === undefined} onClick={() => plusGrand !== undefined && changerZoom(plusGrand)} className={outil}>
                <Icon icon={PlusSignIcon} size={18} />
              </button>
            </div>
            {sommaire.length > 0 && (
              <button type="button" aria-label="Sommaire" onClick={() => setSommaireOuvert(true)} className={outil}>
                <Icon icon={LeftToRightListBulletIcon} size={20} />
              </button>
            )}
          </>
        )}
        <button type="button" aria-label="Mode nuit" aria-pressed={nuit} onClick={() => ecrireNuit(!nuit)} className={cn(outil, nuit && "bg-white/10")}>
          <Icon icon={Moon02Icon} size={20} />
        </button>
        {livre.telechargeable && etat.type === "pdf" && (
          <BoutonTelechargerLivre livreId={livre.id} titre={livre.titre} variant="discret" className="flex-none max-sm:[&_button]:px-2.5 max-sm:[&_button>span]:sr-only" />
        )}
      </header>

      {/* La zone qui défile reçoit le focus : au clavier, les flèches et Page suivante font défiler le livre. Le
          pincement est géré par le lecteur (touch-action) : il redessine les pages au lieu de les étirer. */}
      <main id="contenu" className="flex min-h-0 flex-1 flex-col">
        <div
          ref={setCorps}
          role="region"
          aria-label="Livre"
          tabIndex={0}
          onScroll={suivreDefilement}
          onKeyDown={clavier}
          onTouchStart={debutToucher}
          onTouchMove={mouvementToucher}
          onTouchEnd={finToucher}
          onTouchCancel={finToucher}
          className="focus-etudium min-h-0 flex-1 overflow-auto [touch-action:pan-x_pan-y] [overscroll-behavior:contain]"
        >
          <p className="m-0 hidden p-6 text-sm text-texte print:block">L’impression de ce livre n’est pas disponible.</p>
          <div className="py-4 print:hidden max-sm:py-3">
            {etat.type === "chargement" && (
              <div role="status" className={cn("flex flex-col items-center gap-3 py-16 text-sm", nuit ? "text-[#AEB7C8]" : "text-discret")}>
                <Spinner size={24} />
                Ouverture du livre…
              </div>
            )}
            {etat.type === "erreur" && (
              <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
                <p role="alert" className="m-0 text-sm leading-[22px] text-erreur-texte">
                  {etat.message}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="contour"
                    onClick={() => {
                      setEtat({ type: "chargement" });
                      setEssai((n) => n + 1);
                    }}
                  >
                    Réessayer
                  </Button>
                  <Button asChild variant="gris">
                    <Link href={adresseLivre(livre.slug)}>Retour à la fiche</Link>
                  </Button>
                </div>
              </div>
            )}
            {etat.type === "pdf" && (
              <div
                ref={pages}
                className={cn(
                  "flex origin-top flex-col items-center gap-4 px-4 max-sm:gap-3",
                  nuit && "[&_[role=img]]:bg-[#1B2130] [&_canvas]:invert [&_canvas]:hue-rotate-180",
                )}
              >
                {Array.from({ length: etat.document.pages }, (_, i) => (
                  <PagePdf key={i + 1} document={etat.document} numero={i + 1} largeur={largeur} racine={corps} surCadre={surCadre} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <RadixDialog.Root open={sommaireOuvert} onOpenChange={setSommaireOuvert}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[#36476C]/50 motion-safe:animate-fondu" />
          <RadixDialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-[min(360px,88vw)] flex-col bg-panneau shadow-menu outline-none motion-safe:animate-apparition"
          >
            <div className="flex items-center justify-between gap-2 border-b border-bordure-carte py-2 pr-2 pl-4">
              <RadixDialog.Title className="m-0 text-base leading-6 font-semibold text-encre">Sommaire</RadixDialog.Title>
              <RadixDialog.Close aria-label="Fermer le sommaire" className={cn(OUTIL, "size-10 text-discret hover:bg-coque")}>
                <Icon icon={Cancel01Icon} size={20} />
              </RadixDialog.Close>
            </div>
            <nav aria-label="Parties du livre" className="min-h-0 flex-1 overflow-y-auto p-2">
              <ListeSommaire
                entrees={sommaire}
                choisir={(numero) => {
                  setSommaireOuvert(false);
                  allerA(numero);
                }}
              />
            </nav>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </div>
  );
}
