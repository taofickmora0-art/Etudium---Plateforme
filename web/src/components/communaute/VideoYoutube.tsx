"use client";

import { useState } from "react";
import { PlayIcon, YoutubeIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * Une vidéo YouTube (spec du fil « Actualités », §2 et §3) : l'image de la vidéo et le bouton Lecture ; le lecteur sans
 * cookies (youtube-nocookie.com) ne se charge qu'au clic.
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
  const [lecture, setLecture] = useState(false);
  if (lecture) {
    return (
      <div className={cn("relative aspect-video overflow-hidden bg-encre", className)}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title="Vidéo YouTube"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      </div>
    );
  }
  return (
    <div className={cn("relative flex aspect-video items-center justify-center overflow-hidden bg-encre", className)}>
      {/* L'image de la vidéo, servie par YouTube : l'optimisation d'images de Next ne s'y applique pas. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 size-full object-cover" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <button
        type="button"
        aria-label={libelle}
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
          href={`https://www.youtube.com/watch?v=${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-etudium absolute right-3.5 bottom-3 flex items-center gap-1.5 rounded-puce text-[13px] leading-5 font-medium text-white no-underline hover:underline"
        >
          <Icon icon={YoutubeIcon} size={18} />
          Regarder sur YouTube
        </a>
      )}
    </div>
  );
}
