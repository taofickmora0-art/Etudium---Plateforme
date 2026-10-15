"use client";

import { useEffect, useRef, useState } from "react";
import { FullScreenIcon, MinimizeScreenIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";

/**
 * Le coin haut droit d'un lecteur intégré qui y met un bouton « ouvrir sur la plateforme » (Google Drive : ouvrir la
 * vidéo dans Drive, d'où on la télécharge). Un carré Étudium le cache et en bloque le clic ; il porte notre propre
 * « Plein écran », qui agrandit tout le cadre, ce carré compris (celui de la plateforme est coupé : en plein écran, son
 * lecteur repasserait par-dessus et le bouton reviendrait).
 */
export function CoinVideo() {
  const coin = useRef<HTMLDivElement>(null);
  const [plein, setPlein] = useState(false);
  useEffect(() => {
    const ecran = () => setPlein(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", ecran);
    return () => document.removeEventListener("fullscreenchange", ecran);
  }, []);
  return (
    <div ref={coin} data-coin-video="" className="absolute top-0 right-0 z-10 flex size-[72px] items-start justify-end rounded-bl-[14px] bg-encre p-3">
      <button
        type="button"
        aria-label={plein ? "Quitter le plein écran" : "Plein écran"}
        onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void coin.current?.parentElement?.requestFullscreen())}
        className="focus-blanc flex size-10 cursor-pointer items-center justify-center rounded-champ text-white transition-colors hover:bg-white/15"
      >
        <Icon icon={plein ? MinimizeScreenIcon : FullScreenIcon} size={20} />
      </button>
    </div>
  );
}
