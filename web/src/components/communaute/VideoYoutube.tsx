"use client";

import { VideoIntegree } from "./VideoIntegree";

/**
 * Une vidéo YouTube (l'annonce, l'aperçu d'un lien) : la vidéo intégrée de la plateforme YouTube, lue au clic sans cookies.
 */
export function VideoYoutube({
  id,
  libelle = "Lire la vidéo YouTube",
  accent = false,
  lien = true,
  className,
}: {
  id: string;
  libelle?: string;
  /** Le bouton bleu de l'annonce ; blanc dans une publication. */
  accent?: boolean;
  /** « Regarder sur YouTube », en bas à droite. */
  lien?: boolean;
  className?: string;
}) {
  return <VideoIntegree video={{ plateforme: "youtube", id, url: `https://www.youtube.com/watch?v=${id}` }} libelle={libelle} accent={accent} lien={lien} className={className} />;
}
