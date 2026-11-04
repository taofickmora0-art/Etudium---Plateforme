"use client";

import { useState } from "react";
import { LinkSquare02Icon, PlayIcon, YoutubeIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { domaine } from "@/lib/communaute/liens";
import { lecteurVideo, miniatureVideo, nomPlateforme, pageVideo, verticale, type Video } from "@/lib/communaute/video";

const FOND = "absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,#3A3F55_0,#1D1D1F_70%)]";

/** Une autre plateforme : la carte de sa page (image, domaine, titre), ouverte dans un nouvel onglet. */
function CarteVideo({ video, className }: { video: Video; className?: string }) {
  const site = domaine(video.url);
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener nofollow ugc"
      className={cn("focus-etudium flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-bordure-carte text-inherit no-underline transition-colors hover:border-bordure-champ", className)}
    >
      <span className="relative flex aspect-video items-center justify-center bg-encre">
        {video.image ? (
          // L'image d'un autre site : l'optimisation d'images de Next ne s'y applique pas.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.image} alt="" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span aria-hidden className={FOND} />
        )}
        <span className="relative flex h-11 w-16 items-center justify-center rounded-champ bg-white text-encre shadow-[0_1px_2px_rgba(20,20,30,0.2)]">
          <Icon icon={PlayIcon} size={22} className="[&_path]:fill-current" />
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 bg-page px-3.5 py-3">
        <span className="truncate text-xs leading-[17px] tracking-[0.04em] text-discret uppercase">{site}</span>
        <span className="line-clamp-2 text-[15px] leading-[22px] font-semibold wrap-anywhere text-encre max-sm:text-sm">{video.titre || `Regarder sur ${site}`}</span>
      </span>
    </a>
  );
}

/**
 * Une vidéo jointe (spec mise en forme et vidéo, §3). Une plateforme connue : son image (ou un fond sombre) et Lecture ;
 * le lecteur, construit depuis la plateforme et l'identifiant, ne se charge qu'au clic. Un fichier : le lecteur du
 * navigateur. Une autre plateforme : la carte de sa page.
 */
export function VideoIntegree({
  video,
  libelle,
  accent = false,
  lien = true,
  className,
}: {
  video: Video;
  /** Le nom du bouton Lecture ; par défaut « Lire la vidéo <plateforme> ». */
  libelle?: string;
  /** Le bouton bleu (l'annonce) ; blanc sinon. */
  accent?: boolean;
  /** « Regarder sur <plateforme> », en bas à droite. */
  lien?: boolean;
  className?: string;
}) {
  const [lecture, setLecture] = useState(false);
  const nom = nomPlateforme(video);
  if (video.plateforme === "fichier") {
    return <video src={video.url} controls preload="metadata" playsInline className={cn("block max-h-[480px] w-full bg-encre", className)} />;
  }
  const lecteur = lecteurVideo(video);
  if (video.plateforme === "autre" || !lecteur) return <CarteVideo video={video} className={className} />;
  // Le fil a la largeur de la page (4 novembre 2026) : une vidéo horizontale ne dépasse pas 720 px de large.
  const cadre = cn("relative overflow-hidden bg-encre", verticale(video) ? "mx-auto aspect-[9/16] w-full max-w-[340px]" : "aspect-video w-full max-w-[720px]", className);
  if (lecture) {
    return (
      <div className={cadre}>
        <iframe
          src={lecteur}
          title={`Vidéo ${nom}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      </div>
    );
  }
  const miniature = miniatureVideo(video);
  return (
    <div className={cn(cadre, "flex items-center justify-center")}>
      {miniature ? (
        // L'image de la vidéo, servie par sa plateforme : l'optimisation d'images de Next ne s'y applique pas.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={miniature} alt="" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <span aria-hidden className={FOND} />
          <span aria-hidden className="absolute top-3 left-3.5 text-sm leading-5 font-semibold text-white">
            {nom}
          </span>
        </>
      )}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <button
        type="button"
        aria-label={libelle ?? `Lire la vidéo ${nom}`}
        onClick={() => setLecture(true)}
        className={cn(
          "focus-etudium relative flex h-11 w-16 items-center justify-center rounded-champ shadow-[0_1px_2px_rgba(20,20,30,0.2)] transition-transform hover:scale-105 motion-reduce:transition-none",
          accent ? "bg-bleu text-white hover:bg-bleu-survol" : "bg-white text-encre",
        )}
      >
        <Icon icon={PlayIcon} size={22} className="[&_path]:fill-current" />
      </button>
      {lien && (
        <a
          href={pageVideo(video)}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-etudium absolute right-3.5 bottom-3 flex items-center gap-1.5 rounded-puce text-[13px] leading-5 font-medium text-white no-underline hover:underline"
        >
          <Icon icon={video.plateforme === "youtube" ? YoutubeIcon : LinkSquare02Icon} size={18} />
          Regarder sur {nom}
        </a>
      )}
    </div>
  );
}
