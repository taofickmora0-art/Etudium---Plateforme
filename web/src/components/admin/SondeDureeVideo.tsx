"use client";

import { useEffect, useRef } from "react";
import type { VideoLecon } from "@/lib/lecon/types";
import { creerAdaptateur, type Adaptateur } from "@/lib/video/adaptateurs";

/** YouTube donne parfois 0 tant que la vidéo n'est pas prête : une relecture par seconde, pendant 20 s au plus. */
const ESSAIS = 20;

/**
 * Lit la vraie durée d'une vidéo dans l'éditeur de leçon, avec le lecteur officiel (YouTube, Vimeo), invisible et
 * détruit aussitôt la durée connue. Le temps regardé se mesure par rapport à la durée de la leçon : saisie à la main,
 * elle peut manquer ou dépasser la vidéo, et l'étudiant ne peut alors jamais atteindre le seuil. L'aperçu visible reste
 * le lecteur intégré, avec ses commandes. Un lecteur qui ne se charge pas (réseau, bloqueur) le signale (onEchec) : la
 * durée reste alors à saisir à la main.
 */
export function SondeDureeVideo({ video, onDuree, onEchec }: { video: VideoLecon; onDuree: (secondes: number) => void; onEchec?: () => void }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const signaler = useRef(onDuree);
  const abandonner = useRef(onEchec);
  useEffect(() => {
    signaler.current = onDuree;
    abandonner.current = onEchec;
  }, [onDuree, onEchec]);

  const { fournisseur, id } = video;
  useEffect(() => {
    let annule = false;
    let adaptateur: Adaptateur | null = null;
    let minuteur: number | undefined;
    const rien = () => undefined;
    creerAdaptateur({ fournisseur, id }, conteneur.current!, { pret: rien, etat: rien, fin: rien })
      .then((a) => {
        if (annule) return a.detruire();
        adaptateur = a;
        let essais = 0;
        const fermer = () => {
          a.detruire();
          adaptateur = null;
        };
        const abandon = () => {
          fermer();
          abandonner.current?.();
        };
        const lire = () => {
          void a
            .duree()
            .then((d) => {
              if (annule) return;
              if (d > 0) {
                // Vers le bas : une durée de leçon plus longue que la vidéo rendrait le seuil de 100 % impossible.
                signaler.current(Math.floor(d));
                fermer();
                return;
              }
              // TikTok, Tella : la durée n'arrive qu'en lecture ; on lance la vidéo, sans le son.
              if (essais === 0) {
                a.setMuet(true);
                a.lire();
              }
              if (++essais < ESSAIS) minuteur = window.setTimeout(lire, 1000);
              else abandon();
            })
            .catch(() => !annule && abandon());
        };
        lire();
      })
      .catch(() => !annule && abandonner.current?.());
    return () => {
      annule = true;
      window.clearTimeout(minuteur);
      adaptateur?.detruire();
    };
  }, [fournisseur, id]);

  // « inert » : le lecteur caché ne prend jamais le focus du clavier.
  return <div ref={conteneur} inert aria-hidden="true" className="pointer-events-none fixed top-0 -left-[9999px] h-[180px] w-[320px] overflow-hidden opacity-0" />;
}
