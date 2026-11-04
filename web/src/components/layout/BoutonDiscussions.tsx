"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
// bouton, chacun avec ses non-lus ; la croix, l'écran sombre, Échap ou le choix d'un lien referment.

/** Le temps de l'animation de fermeture, avant de retirer l'éventail. */
const FERMETURE_MS = 180;
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
  const bouton = useRef<HTMLButtonElement>(null);
  const premier = useRef<HTMLDivElement>(null);
  const [centre, setCentre] = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  function ouvrir() {
    const zone = bouton.current?.getBoundingClientRect();
    if (!zone) return;
    if (minuterie.current) clearTimeout(minuterie.current);
    setCentre({ x: zone.left + zone.width / 2, y: zone.top + zone.height / 2 });
    // L'éventail paraît fermé, puis s'ouvre à l'image suivante : la transition joue.
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }

  function fermer() {
    setVisible(false);
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => {
      setCentre(null);
      bouton.current?.focus();
    }, FERMETURE_MS);
  }

  useEffect(() => {
    if (!centre) return;
    premier.current?.querySelector("a")?.focus();
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [centre]);
  useEffect(() => () => {
    if (minuterie.current) clearTimeout(minuterie.current);
  }, []);

  return (
    <div className="flex min-w-[64px] flex-auto flex-col items-center">
      <button
        ref={bouton}
        type="button"
        onClick={ouvrir}
        aria-haspopup="dialog"
        aria-expanded={centre !== null}
        aria-label={`Discussions${nonLus(total)}`}
        data-actif={actif ? "true" : undefined}
        className="focus-etudium relative -mt-5 flex cursor-pointer flex-col items-center gap-[3px] border-0 bg-transparent p-0 text-[10px] leading-3 font-semibold tracking-[-0.01em]"
      >
        <span className={cn("relative flex size-[54px] items-center justify-center rounded-full border-4 border-page bg-bleu text-white shadow-[0_8px_18px_rgba(11,24,201,0.35)]", actif && "ring-2 ring-bleu-pale")}>
          <Icon icon={Chatting01Icon} size={24} />
          {total > 0 && <PastilleNombre nombre={total} className="absolute -top-1 -right-1.5 ring-2 ring-panneau" />}
        </span>
        <span className="text-bleu">Discussions</span>
      </button>
      {centre &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label="Discussions" className="fixed inset-0 z-[60]">
            <div
              data-testid="voile-discussions"
              aria-hidden="true"
              onClick={fermer}
              className={cn("absolute inset-0 bg-encre/45 transition-opacity duration-200 motion-reduce:transition-none", visible ? "opacity-100" : "opacity-0")}
            />
            <div ref={premier} className="absolute" style={{ left: centre.x, top: centre.y }}>
              <Choix href="/messages" label="Messages" icon={BubbleChatIcon} nombre={messages} visible={visible} cote={-1} onChoisir={fermer} />
              <Choix href="/groupes" label="Groupes" icon={MessageMultiple02Icon} nombre={groupes} visible={visible} cote={1} onChoisir={fermer} />
              <button
                type="button"
                onClick={fermer}
                aria-label="Fermer"
                style={{ transform: `translate(-50%, -50%) rotate(${visible ? 0 : -90}deg)` }}
                className="focus-etudium absolute top-0 left-0 flex size-[54px] cursor-pointer items-center justify-center rounded-full border-0 bg-panneau text-encre shadow-menu transition-transform duration-200 motion-reduce:transition-none"
              >
                <Icon icon={Cancel01Icon} size={22} />
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
