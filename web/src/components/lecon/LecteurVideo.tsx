import { urlIntegration } from "@/lib/lecon/regles";
import type { VideoLecon } from "@/lib/lecon/types";

/**
 * Vidéo de la leçon (NdLecon) : boîte 16/9 sombre, arrondie, avec le lecteur officiel de YouTube ou de Vimeo.
 * Le lecteur aux couleurs d'Étudium, qui mesure le temps réellement regardé, arrive avec la tâche 1.6.
 */
export function LecteurVideo({ video, titre }: { video: VideoLecon; titre: string }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-carte bg-encre">
      <iframe
        src={urlIntegration(video)}
        title={`Vidéo : ${titre}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 size-full border-0"
      />
    </div>
  );
}
