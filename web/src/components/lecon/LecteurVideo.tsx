import { cn } from "@/lib/cn";
import { formatVideo, urlIntegration } from "@/lib/lecon/regles";
import type { VideoLecon } from "@/lib/lecon/types";
import { aCoinMasque } from "@/lib/video/plateformes";
import { CoinVideo } from "./CoinVideo";

/**
 * Vidéo de la leçon (NdLecon) : boîte sombre, arrondie (16/9, ou verticale pour TikTok), avec le lecteur officiel de la
 * plateforme. C'est le lecteur des plateformes sans mesure (Loom, ScreenPal, Google Drive) et celui de l'aperçu.
 * Google Drive : son bouton « ouvrir dans Drive » est caché et son plein écran coupé (voir CoinVideo).
 */
export function LecteurVideo({ video, titre }: { video: VideoLecon; titre: string }) {
  const coin = aCoinMasque(video.fournisseur);
  return (
    <div className={cn("relative overflow-hidden rounded-carte bg-encre", formatVideo(video))}>
      <iframe
        src={urlIntegration(video)}
        title={`Vidéo : ${titre}`}
        allow={`accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture${coin ? "" : "; fullscreen"}`}
        allowFullScreen={!coin}
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 size-full border-0"
      />
      {coin && <CoinVideo />}
    </div>
  );
}
