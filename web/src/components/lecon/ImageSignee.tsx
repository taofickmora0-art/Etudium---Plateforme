"use client";

import { useRouter } from "next/navigation";

// Le dernier rechargement demandé, pour toute la page : au plus un par minute, même si plusieurs images échouent.
let derniereRelecture = 0;

/** Le routeur de l'appli ; null hors de lui (aperçu rendu ailleurs) : l'image reste alors telle quelle. */
function useRouteurFacultatif() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

/**
 * Une image privée de leçon, servie par un lien signé d'une heure (point reporté du lot 4) : sur une page restée ouverte
 * plus longtemps, le lien expire. L'image qui ne se charge plus relit la page (de nouveaux liens), au plus une fois par
 * minute : une image vraiment absente ne fait pas boucler.
 */
export function ImageSignee({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const router = useRouteurFacultatif();
  const relire = () => {
    if (!router || Date.now() - derniereRelecture < 60_000) return;
    derniereRelecture = Date.now();
    router.refresh();
  };
  // eslint-disable-next-line @next/next/no-img-element -- image privée, servie par un lien signé d'une heure
  return <img src={src} alt={alt} loading="lazy" onError={relire} className={className} />;
}
