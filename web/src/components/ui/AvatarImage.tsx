"use client";

import { useState } from "react";

/** Photo du rond d'avatar ; si elle ne se charge pas (fichier supprimé, réseau), les initiales reviennent. */
export function AvatarImage({ src, initials, hideInitials }: { src: string; initials: string; hideInitials?: boolean }) {
  const [echec, setEchec] = useState(false);
  if (echec) return <span aria-hidden={hideInitials || undefined}>{initials}</span>;
  // eslint-disable-next-line @next/next/no-img-element -- photo déjà réduite à 512 px à l'envoi, servie par Supabase
  return <img src={src} alt="" className="size-full object-cover" onError={() => setEchec(true)} />;
}
