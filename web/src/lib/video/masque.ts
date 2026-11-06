import type { Video } from "./plateformes";

// Le lien d'une vidéo de leçon, caché au mieux : l'identifiant part brouillé dans le code de la page (« Afficher le code
// source » ne le montre pas), et le lecteur le retrouve juste avant de se lancer. Ce n'est pas une protection : l'outil
// d'inspection du navigateur montre toujours le lecteur de la plateforme une fois lancé. Seule une plateforme qui limite
// la lecture à etudium.online (Vimeo « Embed only », Bunny Stream…) empêche vraiment de regarder ailleurs.

/** Une vidéo dont l'identifiant est brouillé, pour le navigateur. */
export type VideoMasquee = { fournisseur: Video["fournisseur"]; code: string };

const CLE = "etudium-lecon";

const melanger = (octets: Uint8Array) => octets.map((o, i) => o ^ CLE.charCodeAt(i % CLE.length));

export function masquerVideo(video: Video): VideoMasquee {
  const brouille = melanger(new TextEncoder().encode(video.id));
  const code = btoa(String.fromCharCode(...brouille)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { fournisseur: video.fournisseur, code };
}

export function demasquerVideo(video: VideoMasquee): Video {
  const base64 = video.code.replace(/-/g, "+").replace(/_/g, "/");
  const octets = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return { fournisseur: video.fournisseur, id: new TextDecoder().decode(melanger(octets)) };
}
