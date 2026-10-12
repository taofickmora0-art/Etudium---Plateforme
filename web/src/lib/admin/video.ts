// Liens des vidéos des leçons (spec du lot 1, §5) : YouTube pour les formations gratuites, Vimeo pour les payantes.
// La base garde le fournisseur et l'identifiant, jamais le lien collé (contrainte lecons_contenus_video de la 0004).

export type Video = { fournisseur: "youtube" | "vimeo"; id: string };

const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;
const ID_VIMEO = /^\d{6,12}$/;
const CODE_VIMEO = /^[0-9a-f]{6,20}$/;

const youtube = (id: string | null | undefined): Video | null => (id && ID_YOUTUBE.test(id) ? { fournisseur: "youtube", id } : null);

/** Reconnaît un lien YouTube ou Vimeo sous ses formes courantes ; null pour tout le reste. */
export function parseVideoUrl(lien: string): Video | null {
  const brut = lien.trim();
  if (!brut) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(brut) ? brut : `https://${brut}`);
  } catch {
    return null;
  }
  const hote = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  const segments = url.pathname.split("/").filter(Boolean);

  if (hote === "youtu.be") return youtube(segments[0]);
  if (hote === "youtube.com" || hote === "youtube-nocookie.com") {
    if (url.pathname === "/watch") return youtube(url.searchParams.get("v"));
    // « embed/videoseries?list=… » est une playlist, pas une vidéo (le mot fait lui aussi 11 caractères).
    if (["embed", "shorts", "live", "v"].includes(segments[0] ?? "") && segments[1] !== "videoseries") return youtube(segments[1]);
    return null;
  }

  if (hote === "vimeo.com" || hote === "player.vimeo.com") {
    // vimeo.com/123456789, vimeo.com/123456789/<code> (non répertoriée), player.vimeo.com/video/123456789?h=<code>,
    // vimeo.com/channels/<nom>/123456789… Dans une vitrine, un album ou un groupe (« showcase/7302342/video/432523532 »),
    // la vidéo est celle qui suit « video » ou « videos », pas le premier nombre.
    const apresVideo = segments.findIndex((s, i) => (s === "video" || s === "videos") && ID_VIMEO.test(segments[i + 1] ?? ""));
    const position = apresVideo >= 0 ? apresVideo + 1 : segments.findIndex((s) => ID_VIMEO.test(s));
    if (position < 0) return null;
    const id = segments[position];
    const parametre = url.searchParams.get("h");
    if (parametre !== null) return CODE_VIMEO.test(parametre) ? { fournisseur: "vimeo", id: `${id}/${parametre}` } : null;
    const suivant = segments[position + 1];
    return { fournisseur: "vimeo", id: suivant && CODE_VIMEO.test(suivant) ? `${id}/${suivant}` : id };
  }
  return null;
}

/** « YouTube · dQw4w9WgXcQ », affiché sous le champ quand le lien est reconnu. */
export const videoLabel = (video: Video) => `${video.fournisseur === "youtube" ? "YouTube" : "Vimeo"} · ${video.id}`;

/** Lien public, pour réafficher la vidéo enregistrée dans le champ. */
export const videoLink = (video: Video) => (video.fournisseur === "youtube" ? `https://youtu.be/${video.id}` : `https://vimeo.com/${video.id}`);
