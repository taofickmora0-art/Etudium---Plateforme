"use client";

import { useEffect, useRef, useState } from "react";
import { Cancel01Icon, MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { Dialog as RadixDialog } from "radix-ui";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { lienConsultation } from "@/lib/lecon/actions";
import type { RessourceLecon } from "@/lib/lecon/types";
import { ouvrirPdf, type DocumentPdf } from "@/lib/ressources/pdf";

type Props = {
  /** La ressource à consulter ; null : le visualiseur est fermé. */
  ressource: RessourceLecon | null;
  onFermer: () => void;
  /** Remplacent pdf.js et l'action serveur (tests). */
  ouvrir?: typeof ouvrirPdf;
  consulter?: typeof lienConsultation;
};

const ZOOMS = [0.75, 1, 1.25, 1.5, 2];
const ECHEC = "Ce document n’a pas pu être affiché.";
/** Largeur des pages avant la première mesure (et dans les tests, où rien n'a de taille). */
const LARGEUR_PAR_DEFAUT = 800;

type Etat = { type: "chargement" } | { type: "erreur"; message: string } | { type: "pdf"; document: DocumentPdf } | { type: "image"; url: string };

const BOUTON_OUTIL =
  "focus-etudium flex size-9 flex-none cursor-pointer items-center justify-center rounded-puce text-texte transition-colors hover:bg-coque disabled:cursor-not-allowed disabled:opacity-45";

/** Une page du PDF, dessinée quand elle approche de l'écran (un document de 300 pages reste fluide sur téléphone). */
function PagePdf({ document, numero, largeur }: { document: DocumentPdf; numero: number; largeur: number }) {
  const cadre = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === "undefined");
  const [dessinee, setDessinee] = useState(false);

  useEffect(() => {
    if (visible || !cadre.current) return;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "100% 0px" },
    );
    observateur.observe(cadre.current);
    return () => observateur.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !canvas.current) return;
    let annule = false;
    document
      .dessiner(numero, canvas.current, largeur)
      .then(() => !annule && setDessinee(true))
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, [visible, document, numero, largeur]);

  return (
    <div
      ref={cadre}
      role="img"
      aria-label={`Page ${numero} sur ${document.pages}`}
      // Hauteur d'une page A4 tant qu'elle n'est pas dessinée : le défilement reste stable.
      style={dessinee ? undefined : { minHeight: Math.round(largeur * 1.414) }}
      className="mx-auto w-max max-w-none bg-panneau shadow-pastille"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvas} aria-hidden="true" className="block" />
    </div>
  );
}

/** Le contenu du visualiseur pour une ressource : lien temporaire, lecture du fichier, affichage. */
function Contenu({ ressource, ouvrir, consulter, onReessayer }: { ressource: RessourceLecon; ouvrir: typeof ouvrirPdf; consulter: typeof lienConsultation; onReessayer: () => void }) {
  const [etat, setEtat] = useState<Etat>({ type: "chargement" });
  const [zoom, setZoom] = useState(1);
  const corps = useRef<HTMLDivElement>(null);
  const [largeurCadre, setLargeurCadre] = useState(LARGEUR_PAR_DEFAUT);

  useEffect(() => {
    let annule = false;
    let ouvert: DocumentPdf | null = null;
    (async () => {
      try {
        const lien = await consulter(ressource.id);
        if ("erreur" in lien) {
          if (!annule) setEtat({ type: "erreur", message: lien.erreur });
          return;
        }
        if (lien.format.startsWith("image/")) {
          if (!annule) setEtat({ type: "image", url: lien.url });
          return;
        }
        // Le fichier est lu en une fois : le lien de 60 s peut expirer pendant la lecture d'un long document.
        const reponse = await fetch(lien.url);
        if (!reponse.ok) throw new Error(`Lecture du fichier : ${reponse.status}`);
        const document = await ouvrir(await reponse.arrayBuffer());
        if (annule) return document.fermer();
        ouvert = document;
        setEtat({ type: "pdf", document });
      } catch {
        if (!annule) setEtat({ type: "erreur", message: ECHEC });
      }
    })();
    return () => {
      annule = true;
      ouvert?.fermer();
    };
  }, [ressource.id, consulter, ouvrir]);

  // Largeur du cadre : les pages s'y ajustent (à 100 %), et suivent un changement de taille (rotation du téléphone).
  useEffect(() => {
    const element = corps.current;
    if (!element) return;
    const mesurer = () => {
      if (element.clientWidth > 0) setLargeurCadre(element.clientWidth - 32);
    };
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  const rang = ZOOMS.indexOf(zoom);
  const largeur = Math.round(largeurCadre * zoom);
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-bordure-carte py-3 pr-14 pl-5">
        <RadixDialog.Title className="m-0 min-w-0 flex-1 truncate text-base leading-6 font-semibold text-encre">{ressource.titre}</RadixDialog.Title>
        {etat.type === "pdf" && (
          <div className="flex items-center gap-1">
            <span className="mr-2 text-[13px] leading-5 whitespace-nowrap text-discret">{etat.document.pages > 1 ? `${etat.document.pages} pages` : "1 page"}</span>
            <button type="button" aria-label="Réduire" disabled={rang <= 0} onClick={() => setZoom(ZOOMS[rang - 1])} className={BOUTON_OUTIL}>
              <Icon icon={MinusSignIcon} size={18} />
            </button>
            <span className="w-12 text-center text-[13px] leading-5 font-medium text-texte tabular-nums">{Math.round(zoom * 100)} %</span>
            <button type="button" aria-label="Agrandir" disabled={rang >= ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[rang + 1])} className={BOUTON_OUTIL}>
              <Icon icon={PlusSignIcon} size={18} />
            </button>
          </div>
        )}
      </div>
      <div ref={corps} className="min-h-0 flex-1 overflow-auto bg-page p-4">
        {/* À l'impression, le document est remplacé par une phrase : le visualiseur n'est pas fait pour imprimer. */}
        <p className="m-0 hidden text-sm text-texte print:block">L’impression de ce document n’est pas disponible.</p>
        <div className="print:hidden">
          {etat.type === "chargement" && (
            <div role="status" className="flex flex-col items-center gap-3 py-16 text-sm text-discret">
              <Spinner size={24} />
              Chargement du document…
            </div>
          )}
          {etat.type === "erreur" && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p role="alert" className="m-0 text-sm leading-[22px] text-erreur-texte">
                {etat.message}
              </p>
              <Button variant="contour" onClick={onReessayer}>
                Réessayer
              </Button>
            </div>
          )}
          {etat.type === "image" && (
            // Une image du stockage, lien temporaire : pas d'optimisation Next (domaine et durée de vie du lien).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={etat.url}
              alt={ressource.titre}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="mx-auto block h-auto max-w-full select-none"
            />
          )}
          {etat.type === "pdf" && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: etat.document.pages }, (_, i) => (
                <PagePdf key={i + 1} document={etat.document} numero={i + 1} largeur={largeur} />
              ))}
            </div>
          )}
        </div>
      </div>
      <RadixDialog.Description className="m-0 border-t border-bordure-carte px-5 py-2.5 text-xs leading-[18px] text-discret">Document en consultation seule.</RadixDialog.Description>
    </>
  );
}

/**
 * Visualiseur intégré (spec du lot 1, §6) : un PDF page par page, ou une image, dans une grande fenêtre (plein écran sur
 * téléphone). Ni téléchargement ni impression dans l'interface ; ce n'est pas une protection absolue, et rien ne le
 * prétend. Le cadre reprend la planche des modales.
 */
export function VisualiseurRessource({ ressource, onFermer, ouvrir = ouvrirPdf, consulter = lienConsultation }: Props) {
  const [essai, setEssai] = useState(0);
  return (
    <RadixDialog.Root open={ressource !== null} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[#36476C]/60 motion-safe:animate-fondu print:hidden" />
        <RadixDialog.Content className="fixed inset-0 z-50 m-auto flex h-dvh w-full flex-col overflow-hidden bg-panneau shadow-menu outline-none motion-safe:animate-apparition sm:h-[90dvh] sm:max-w-[960px] sm:rounded-bloc">
          <RadixDialog.Close
            aria-label="Fermer"
            className="focus-etudium absolute top-2.5 right-3 z-10 flex size-10 cursor-pointer items-center justify-center rounded-puce text-discret transition-colors hover:bg-coque"
          >
            <Icon icon={Cancel01Icon} size={20} />
          </RadixDialog.Close>
          {ressource && <Contenu key={`${ressource.id}-${essai}`} ressource={ressource} ouvrir={ouvrir} consulter={consulter} onReessayer={() => setEssai((n) => n + 1)} />}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
