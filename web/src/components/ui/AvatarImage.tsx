"use client";

import { useEffect, useRef, useState } from "react";

/** Photo du rond d'avatar ; si elle ne se charge pas (fichier supprimé, réseau), les initiales reviennent. */
export function AvatarImage({ src, initials, hideInitials }: { src: string; initials: string; hideInitials?: boolean }) {
  const [echec, setEchec] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  // L'image arrive avec la page : si elle a échoué avant que React ne s'y branche, onError ne sera jamais appelé.
  useEffect(() => {
    const img = image.current;
    if (img?.complete && img.naturalWidth === 0) setEchec(true);
  }, []);
  if (echec) return <span aria-hidden={hideInitials || undefined}>{initials}</span>;
  // eslint-disable-next-line @next/next/no-img-element -- photo déjà réduite à 512 px à l'envoi, servie par Supabase
  return <img ref={image} src={src} alt="" className="size-full object-cover" onError={() => setEchec(true)} />;
}
