import { domaine, idYoutube } from "./liens";

// La vidéo jointe à une publication (spec mise en forme et vidéo, §3). Règles pures : le serveur, les écrans et la
// relecture de la base s'en servent. Le lecteur intégré est construit depuis la plateforme et l'identifiant (vérifiés
// par les mêmes formes que la base, migration 0022), jamais depuis une adresse fournie.

export type PlateformeVideo = "youtube" | "vimeo" | "dailymotion" | "loom" | "tiktok" | "facebook" | "instagram" | "drive" | "fichier" | "autre";

/** `url` : l'adresse collée ; `id` (et `h` pour Vimeo) : l'identifiant ; `titre` et `image` : la page d'une autre plateforme. */
export type Video = { plateforme: PlateformeVideo; url: string; id?: string; h?: string; titre?: string; image?: string | null };

/** Les formes d'identifiant, les mêmes que `verifier_video` (migration 0022). */
export const FORMES_ID: Record<Exclude<PlateformeVideo, "fichier" | "autre">, RegExp> = {
  youtube: /^[A-Za-z0-9_-]{11}$/,
  vimeo: /^\d{6,12}$/,
  dailymotion: /^[A-Za-z0-9]{5,12}$/,
  loom: /^[a-f0-9]{32}$/,
  tiktok: /^\d{10,25}$/,
  facebook: /^\d{5,25}$/,
  instagram: /^[A-Za-z0-9_-]{5,30}$/,
  drive: /^[A-Za-z0-9_-]{20,80}$/,
};
const FORME_H = /^[a-f0-9]{6,20}$/;
const FICHIER = /\.(mp4|webm|ogg|ogv)$/i;
export const ADRESSE_MAX = 1000;

const NOMS: Record<Exclude<PlateformeVideo, "autre">, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  dailymotion: "Dailymotion",
  loom: "Loom",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
  drive: "Google Drive",
  fichier: "Vidéo",
};

const valide = (plateforme: keyof typeof FORMES_ID, id: string | null | undefined): id is string => !!id && FORMES_ID[plateforme].test(id);

/** L'identifiant et la plateforme d'une adresse, ou null si elle n'est d'aucune plateforme connue. */
function plateformeDe(u: URL): Pick<Video, "plateforme" | "id" | "h"> | null {
  const hote = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const morceaux = u.pathname.split("/").filter(Boolean);
  const youtube = idYoutube(u.toString());
  if (youtube) return { plateforme: "youtube", id: youtube };
  if (hote === "vimeo.com" || hote === "player.vimeo.com") {
    const position = morceaux.findIndex((m) => /^\d+$/.test(m));
    const id = position >= 0 ? morceaux[position] : null;
    const h = u.searchParams.get("h") ?? (position >= 0 ? morceaux[position + 1] : undefined);
    if (valide("vimeo", id)) return { plateforme: "vimeo", id, ...(h && FORME_H.test(h) ? { h } : {}) };
  }
  if (hote === "dailymotion.com" && morceaux[0] === "video") {
    const id = morceaux[1]?.split("_")[0];
    if (valide("dailymotion", id)) return { plateforme: "dailymotion", id };
  }
  if (hote === "dai.ly" && valide("dailymotion", morceaux[0])) return { plateforme: "dailymotion", id: morceaux[0] };
  if (hote === "loom.com" && (morceaux[0] === "share" || morceaux[0] === "embed") && valide("loom", morceaux[1])) return { plateforme: "loom", id: morceaux[1] };
  if (hote === "tiktok.com" && morceaux[1] === "video" && valide("tiktok", morceaux[2])) return { plateforme: "tiktok", id: morceaux[2] };
  if (hote === "facebook.com" || hote === "fb.com") {
    const id = morceaux[0] === "watch" ? u.searchParams.get("v") : morceaux[0] === "reel" ? morceaux[1] : morceaux[1] === "videos" ? morceaux[2] : null;
    if (valide("facebook", id)) return { plateforme: "facebook", id };
  }
  if (hote === "instagram.com" && ["reel", "reels", "p", "tv"].includes(morceaux[0] ?? "") && valide("instagram", morceaux[1])) {
    return { plateforme: "instagram", id: morceaux[1] };
  }
  if (hote === "drive.google.com" && morceaux[0] === "file" && morceaux[1] === "d" && valide("drive", morceaux[2])) return { plateforme: "drive", id: morceaux[2] };
  if (u.protocol === "https:" && FICHIER.test(u.pathname)) return { plateforme: "fichier" };
  return null;
}

/** La vidéo d'une adresse : une plateforme connue, un fichier en https, ou une autre page (carte) ; null si ce n'est pas une adresse web. */
export function reconnaitreVideo(adresse: string): Video | null {
  const texte = adresse.trim();
  if (!/^https?:\/\//i.test(texte) || texte.length > ADRESSE_MAX) return null;
  let u: URL;
  try {
    u = new URL(texte);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  return { ...(plateformeDe(u) ?? { plateforme: "autre" }), url: texte };
}

/** L'adresse du lecteur intégré ; null pour un fichier (lecteur du navigateur) ou une autre plateforme (carte). */
export function lecteurVideo(v: Video): string | null {
  const id = encodeURIComponent(v.id ?? "");
  switch (v.plateforme) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
    case "vimeo":
      return `https://player.vimeo.com/video/${id}?autoplay=1${v.h ? `&h=${encodeURIComponent(v.h)}` : ""}`;
    case "dailymotion":
      return `https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
    case "loom":
      return `https://www.loom.com/embed/${id}?autoplay=1`;
    case "tiktok":
      return `https://www.tiktok.com/embed/v2/${id}`;
    case "facebook":
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(`https://www.facebook.com/watch/?v=${v.id}`)}&show_text=false&autoplay=true`;
    case "instagram":
      return `https://www.instagram.com/p/${id}/embed`;
    case "drive":
      return `https://drive.google.com/file/d/${id}/preview`;
    default:
      return null;
  }
}

/** La page de la vidéo sur sa plateforme (« Regarder sur … »), construite depuis l'identifiant ; l'adresse collée pour un
 * fichier ou une autre page (dont le domaine est montré). */
export function pageVideo(v: Video): string {
  const id = encodeURIComponent(v.id ?? "");
  switch (v.plateforme) {
    case "youtube":
      return `https://www.youtube.com/watch?v=${id}`;
    case "vimeo":
      return `https://vimeo.com/${id}${v.h ? `/${encodeURIComponent(v.h)}` : ""}`;
    case "dailymotion":
      return `https://www.dailymotion.com/video/${id}`;
    case "loom":
      return `https://www.loom.com/share/${id}`;
    case "tiktok":
      return `https://www.tiktok.com/embed/v2/${id}`;
    case "facebook":
      return `https://www.facebook.com/watch/?v=${id}`;
    case "instagram":
      return `https://www.instagram.com/p/${id}/`;
    case "drive":
      return `https://drive.google.com/file/d/${id}/view`;
    default:
      return v.url;
  }
}

/** L'image d'attente : celle de YouTube ou de Dailymotion, celle de la page d'une autre plateforme ; sinon null. */
export function miniatureVideo(v: Video): string | null {
  if (v.plateforme === "youtube") return `https://i.ytimg.com/vi/${encodeURIComponent(v.id ?? "")}/hqdefault.jpg`;
  if (v.plateforme === "dailymotion") return `https://www.dailymotion.com/thumbnail/video/${encodeURIComponent(v.id ?? "")}`;
  if (v.plateforme === "autre") return v.image ?? null;
  return null;
}

/** TikTok et Instagram : un lecteur vertical. */
export const verticale = (v: Video) => v.plateforme === "tiktok" || v.plateforme === "instagram";

/** « YouTube », « Google Drive »… ; pour une autre plateforme, son domaine. */
export const nomPlateforme = (v: Video) => (v.plateforme === "autre" ? domaine(v.url) : NOMS[v.plateforme]);

const adresseWeb = (valeur: unknown, https = false): string | null =>
  typeof valeur === "string" && valeur.length <= ADRESSE_MAX && (https ? /^https:\/\//i : /^https?:\/\//i).test(valeur) ? valeur : null;

/** Une vidéo rangée par la base, relue avec les mêmes règles ; toute forme douteuse : null (ou image retirée). */
export function videoRangee(valeur: unknown): Video | null {
  if (!valeur || typeof valeur !== "object") return null;
  const v = valeur as Record<string, unknown>;
  const url = adresseWeb(v.url);
  if (!url || typeof v.plateforme !== "string") return null;
  if (v.plateforme === "fichier") return adresseWeb(v.url, true) ? { plateforme: "fichier", url } : null;
  if (v.plateforme === "autre") {
    return {
      plateforme: "autre",
      url,
      ...(typeof v.titre === "string" && v.titre ? { titre: v.titre.slice(0, 200) } : {}),
      ...("image" in v ? { image: adresseWeb(v.image, true) } : {}),
    };
  }
  if (!(v.plateforme in FORMES_ID)) return null;
  const plateforme = v.plateforme as keyof typeof FORMES_ID;
  if (!valide(plateforme, typeof v.id === "string" ? v.id : null)) return null;
  const h = plateforme === "vimeo" && typeof v.h === "string" && FORME_H.test(v.h) ? { h: v.h } : {};
  return { plateforme, id: v.id as string, ...h, url };
}
