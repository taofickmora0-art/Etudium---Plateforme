"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BubbleChatIcon, Cancel01Icon, Chatting01Icon, MessageMultiple02Icon } from "@hugeicons/core-free-icons";
import { useGroupesNonLus } from "@/components/groupes/useGroupesNonLus";
import { useMessagesNonLus } from "@/components/messages/useMessagesNonLus";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { PastilleNombre } from "@/components/ui/PastilleNombre";
import { cn } from "@/lib/cn";
import { isActive } from "@/lib/navigation";

// Le bouton « Discussions » au milieu de la barre du bas de l'étudiant (demande du 4 novembre 2026, maquette validée) :
// il remplace « Événements » (resté dans le menu ≡). Un appui ouvre l'éventail : « Messages » et « Groupes » sortent du
// bouton, chacun avec ses non-lus. Le bouton lui-même reste devant l'écran sombre et son icône tourne en croix : le
// retoucher referme (retour du même jour : pas de seconde croix posée dessus). L'écran sombre, Échap ou le choix d'un
// lien referment aussi.
//
// L'écran sombre et l'éventail restent dans la barre (pas de portail) : la barre du bas forme sa propre couche (sticky,
// z-30), au-dessus de la page et de l'en-tête ; dedans, l'écran sombre (z-10) passe sous le bouton et l'éventail (z-20).

/** Le temps de l'animation de fermeture, avant de retirer l'éventail. */
const FERMETURE_MS = 200;
/** Où sortent les deux choix, depuis le centre du bouton (px). */
const ECART = 74;
const HAUTEUR = 112;

const nonLus = (n: number) => (n > 0 ? `, ${n} non lu${n > 1 ? "s" : ""}` : "");

function Choix({ href, label, icon, nombre, visible, cote, onChoisir }: { href: string; label: string; icon: IconSvgElement; nombre: number; visible: boolean; cote: -1 | 1; onChoisir: () => void }) {
  return (
    <Link
      href={href}
      onClick={onChoisir}
      aria-label={`${label}${nonLus(nombre)}`}
      style={{ transform: visible ? `translate(calc(-50% + ${cote * ECART}px), calc(-50% - ${HAUTEUR}px)) scale(1)` : "translate(-50%, -50%) scale(0.4)" }}
      className={cn(
        "focus-etudium absolute top-0 left-0 flex flex-col items-center gap-1.5 no-underline transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <span className="relative flex size-[62px] items-center justify-center rounded-full bg-panneau text-bleu shadow-menu">
        <Icon icon={icon} size={28} />
        {nombre > 0 && <PastilleNombre nombre={nombre} className="absolute -top-0.5 -right-0.5 ring-2 ring-panneau" />}
      </span>
      <span className="rounded-full bg-panneau px-3 py-1 text-[13px] leading-[18px] font-semibold text-encre shadow-menu">{label}</span>
    </Link>
  );
}

export function BoutonDiscussions({ pathname }: { pathname: string | null }) {
  const messages = useMessagesNonLus("etudiant");
  const groupes = useGroupesNonLus();
  const total = messages + groupes;
  const actif = pathname !== null && (isActive(pathname, "/messages") || isActive(pathname, "/groupes"));
  const eventail = useRef<HTMLDivElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [visible, setVisible] = useState(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  function ouvrir() {
    if (minuterie.current) clearTimeout(minuterie.current);
    setOuvert(true);
    // L'éventail paraît fermé, puis s'ouvre à l'image suivante : la transition joue.
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }

  function fermer() {
    setVisible(false);
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setOuvert(false), FERMETURE_MS);
  }

  useEffect(() => {
    if (!ouvert) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [ouvert]);
  useEffect(() => {
    if (visible) eventail.current?.querySelector("a")?.focus({ preventScroll: true });
  }, [visible]);
  useEffect(() => () => {
    if (minuterie.current) clearTimeout(minuterie.current);
  }, []);

  // Ouvert (ou en train de s'ouvrir) : le bouton est la croix.
  const croix = ouvert && visible;
  return (
    <div className="relative flex min-w-[64px] flex-auto flex-col items-center">
      {ouvert && (
        <div
          data-testid="voile-discussions"
          aria-hidden="true"
          onClick={fermer}
          className={cn("fixed inset-0 z-10 bg-encre/45 transition-opacity duration-200 motion-reduce:transition-none", visible ? "opacity-100" : "opacity-0")}
        />
      )}
      {ouvert && (
        // Le centre du rond du bouton (54 px, remonté de 20 px) : les choix en partent.
        <div ref={eventail} role="dialog" aria-label="Discussions" className="absolute top-[7px] left-1/2 z-20">
          <Choix href="/messages" label="Messages" icon={BubbleChatIcon} nombre={messages} visible={visible} cote={-1} onChoisir={fermer} />
          <Choix href="/groupes" label="Groupes" icon={MessageMultiple02Icon} nombre={groupes} visible={visible} cote={1} onChoisir={fermer} />
        </div>
      )}
      <button
        type="button"
        onClick={() => (ouvert ? fermer() : ouvrir())}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-label={ouvert ? "Fermer les discussions" : `Discussions${nonLus(total)}`}
        data-actif={actif ? "true" : undefined}
        className="focus-etudium relative z-20 -mt-5 flex cursor-pointer flex-col items-center gap-[3px] border-0 bg-transparent p-0 text-[10px] leading-3 font-semibold tracking-[-0.01em]"
      >
        <span className={cn("relative flex size-[54px] items-center justify-center rounded-full border-4 border-page bg-bleu text-white shadow-[0_8px_18px_rgba(11,24,201,0.35)]", actif && !ouvert && "ring-2 ring-bleu-pale")}>
          {/* L'icône tourne et laisse la place à la croix (et l'inverse en refermant). */}
          <span aria-hidden="true" className={cn("absolute inset-0 flex items-center justify-center transition-[transform,opacity] duration-200 motion-reduce:transition-none", croix ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100")}>
            <Icon icon={Chatting01Icon} size={24} />
          </span>
          <span aria-hidden="true" className={cn("absolute inset-0 flex items-center justify-center transition-[transform,opacity] duration-200 motion-reduce:transition-none", croix ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0")}>
            <Icon icon={Cancel01Icon} size={24} />
          </span>
          {total > 0 && !ouvert && <PastilleNombre nombre={total} className="absolute -top-1 -right-1.5 ring-2 ring-panneau" />}
        </span>
        <span className={cn("transition-colors", ouvert ? "text-white" : "text-bleu")}>Discussions</span>
      </button>
    </div>
  );
}
