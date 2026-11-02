// Les plateformes des vidéos des leçons (spec du lot 1, §5 ; spec 2026-10-15-plateformes-video-design).
// La base garde le fournisseur et l'identifiant, jamais le lien collé (contrainte lecons_contenus_video, 0004 puis 0030).
// « Mesurée » : le lecteur de la plateforme donne la position et la durée ; le temps réellement regardé valide la leçon
// au seuil. Sans mesure : le lecteur officiel est intégré tel quel, et la leçon se termine d'un clic.

export type Fournisseur = "youtube" | "vimeo" | "tiktok" | "tella" | "loom" | "screenpal" | "drive";
export type Video = { fournisseur: Fournisseur; id: string };

type Plateforme = {
  nom: string;
  mesuree: boolean;
  /** Lecteur piloté par messages, pas encore éprouvé : s'il ne répond pas, la leçon se termine d'un clic (0030). */
  secours?: boolean;
  /** Le lecteur intégré met un bouton « ouvrir sur la plateforme » dans son coin haut droit (Drive) : on le cache. */
  coinMasque?: boolean;
  verticale?: boolean;
  format: RegExp;
  lien: (id: string) => string;
  integration: (id: string) => string;
};

const PLATEFORMES: Record<Fournisseur, Plateforme> = {
  youtube: {
    nom: "YouTube",
    mesuree: true,
    format: /^[A-Za-z0-9_-]{11}$/,
    lien: (id) => `https://youtu.be/${id}`,
    integration: (id) => `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
  },
  vimeo: {
    nom: "Vimeo",
    mesuree: true,
    // L'identifiant, suivi du code d'une vidéo « non répertoriée » comme dans son lien (76979871/abcdef0123).
    format: /^\d{6,12}(\/[0-9a-f]{6,20})?$/,
    lien: (id) => `https://vimeo.com/${id}`,
    integration: (id) => {
      const [numero, code] = id.split("/");
      return `https://player.vimeo.com/video/${numero}?dnt=1${code ? `&h=${code}` : ""}`;
    },
  },
  tiktok: {
    nom: "TikTok",
    mesuree: true,
    secours: true,
    verticale: true,
    format: /^\d{15,21}$/,
    lien: (id) => `https://www.tiktok.com/player/v1/${id}`,
    integration: (id) => `https://www.tiktok.com/player/v1/${id}?rel=0&music_info=0&description=0`,
  },
  tella: {
    nom: "Tella",
    mesuree: true,
    secours: true,
    format: /^[A-Za-z0-9-]{4,120}$/,
    lien: (id) => `https://www.tella.tv/video/${id}`,
    integration: (id) => `https://www.tella.tv/video/${id}/embed`,
  },
  loom: {
    nom: "Loom",
    mesuree: false,
    format: /^[0-9a-f]{32}$/,
    lien: (id) => `https://www.loom.com/share/${id}`,
    integration: (id) => `https://www.loom.com/embed/${id}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`,
  },
  screenpal: {
    nom: "ScreenPal",
    mesuree: false,
    format: /^[A-Za-z0-9]{6,20}$/,
    lien: (id) => `https://go.screenpal.com/watch/${id}`,
    integration: (id) => `https://go.screenpal.com/player/${id}?title=0`,
  },
  drive: {
    nom: "Google Drive",
    mesuree: false,
    coinMasque: true,
    format: /^[A-Za-z0-9_-]{20,80}$/,
    lien: (id) => `https://drive.google.com/file/d/${id}/view`,
    integration: (id) => `https://drive.google.com/file/d/${id}/preview`,
  },
};

export const FOURNISSEURS = Object.keys(PLATEFORMES) as Fournisseur[];
export const estFournisseur = (valeur: unknown): valeur is Fournisseur => typeof valeur === "string" && valeur in PLATEFORMES;
/** Le lecteur de la plateforme donne la position et la durée : temps regardé, seuil, durée lue dans l'éditeur. */
export const estMesuree = (f: Fournisseur) => PLATEFORMES[f].mesuree;
/** Si le lecteur ne répond pas, la leçon se termine d'un clic (TikTok, Tella) : jamais d'impasse. */
export const aSecoursManuel = (f: Fournisseur) => Boolean(PLATEFORMES[f].secours);
/** Le bouton « ouvrir dans Drive » du lecteur intégré est caché, et son plein écran coupé (on fournit le nôtre). */
export const aCoinMasque = (f: Fournisseur) => Boolean(PLATEFORMES[f].coinMasque);
/** Une vidéo verticale (9:16), comme sur TikTok. */
export const estVertical = (f: Fournisseur) => Boolean(PLATEFORMES[f].verticale);
export const nomPlateforme = (f: Fournisseur) => PLATEFORMES[f].nom;

/** L'identifiant a le format de sa plateforme (le même contrôle que la base, 0030 et 0064). */
export const identifiantValide = (f: Fournisseur, id: unknown): boolean => typeof id === "string" && PLATEFORMES[f].format.test(id);

const VIMEO_NUMERO = /^\d{6,12}$/;
const VIMEO_CODE = /^[0-9a-f]{6,20}$/;
const video = (fournisseur: Fournisseur, id: string | null | undefined): Video | null =>
  id && PLATEFORMES[fournisseur].format.test(id) ? { fournisseur, id } : null;

/** Le lien court d'une vidéo TikTok ne contient pas son identifiant : on le dit, au lieu de « lien non reconnu ». */
export function messageLienCourt(lien: string): string | null {
  const hote = hoteDe(lien);
  if (hote === "vm.tiktok.com" || hote === "vt.tiktok.com" || (hote === "tiktok.com" && /^\/t\//.test(urlDe(lien)?.pathname ?? ""))) {
    return "Lien court TikTok : ouvrez-le, puis copiez le lien complet de la vidéo (…/video/123…).";
  }
  return null;
}

function urlDe(lien: string): URL | null {
  const brut = lien.trim();
  if (!brut) return null;
  try {
    return new URL(/^https?:\/\//i.test(brut) ? brut : `https://${brut}`);
  } catch {
    return null;
  }
}
const hoteDe = (lien: string) => urlDe(lien)?.hostname.toLowerCase().replace(/^(www\.|m\.)/, "") ?? null;

/** Reconnaît un lien de vidéo des plateformes acceptées, sous leurs formes courantes ; null pour tout le reste. */
export function parseVideoUrl(lien: string): Video | null {
  const url = urlDe(lien);
  if (!url) return null;
  const hote = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  const segments = url.pathname.split("/").filter(Boolean);

  if (hote === "youtu.be") return video("youtube", segments[0]);
  if (hote === "youtube.com" || hote === "youtube-nocookie.com") {
    if (url.pathname === "/watch") return video("youtube", url.searchParams.get("v"));
    // « embed/videoseries?list=… » est une playlist, pas une vidéo (le mot fait lui aussi 11 caractères).
    if (["embed", "shorts", "live", "v"].includes(segments[0] ?? "") && segments[1] !== "videoseries") return video("youtube", segments[1]);
    return null;
  }

  if (hote === "vimeo.com" || hote === "player.vimeo.com") {
    // vimeo.com/123456789, vimeo.com/123456789/<code> (non répertoriée), player.vimeo.com/video/123456789?h=<code>,
    // vimeo.com/channels/<nom>/123456789… Dans une vitrine, un album ou un groupe (« showcase/7302342/video/432523532 »),
    // la vidéo est celle qui suit « video » ou « videos », pas le premier nombre.
    const apresVideo = segments.findIndex((s, i) => (s === "video" || s === "videos") && VIMEO_NUMERO.test(segments[i + 1] ?? ""));
    const position = apresVideo >= 0 ? apresVideo + 1 : segments.findIndex((s) => VIMEO_NUMERO.test(s));
    if (position < 0) return null;
    const id = segments[position];
    const parametre = url.searchParams.get("h");
    if (parametre !== null) return VIMEO_CODE.test(parametre) ? { fournisseur: "vimeo", id: `${id}/${parametre}` } : null;
    const suivant = segments[position + 1];
    return { fournisseur: "vimeo", id: suivant && VIMEO_CODE.test(suivant) ? `${id}/${suivant}` : id };
  }

  if (hote === "tiktok.com") {
    // tiktok.com/@nom/video/123…, tiktok.com/player/v1/123…, tiktok.com/embed/v2/123…
    if (segments[0]?.startsWith("@") && segments[1] === "video") return video("tiktok", segments[2]);
    if (segments[0] === "player" && segments[1] === "v1") return video("tiktok", segments[2]);
    if (segments[0] === "embed") return video("tiktok", segments[1] === "v2" ? segments[2] : segments[1]);
    return null;
  }

  if (hote === "tella.tv") return segments[0] === "video" ? video("tella", segments[1]) : null;

  if (hote === "loom.com") return segments[0] === "share" || segments[0] === "embed" ? video("loom", segments[1]) : null;

  if (hote === "screenpal.com" || hote === "go.screenpal.com" || hote === "screencast-o-matic.com") {
    return segments[0] === "watch" || segments[0] === "player" ? video("screenpal", segments[1]) : null;
  }

  if (hote === "drive.google.com") {
    if (segments[0] === "file" && segments[1] === "d") return video("drive", segments[2]);
    if (segments[0] === "open" || segments[0] === "uc") return video("drive", url.searchParams.get("id"));
    return null;
  }
  return null;
}

/** « TikTok · 7234567890123456789 », affiché sous le champ quand le lien est reconnu. */
export const videoLabel = (v: Video) => `${PLATEFORMES[v.fournisseur].nom} · ${v.id}`;

/** Lien public, pour réafficher la vidéo enregistrée dans le champ. */
export const videoLink = (v: Video) => PLATEFORMES[v.fournisseur].lien(v.id);

/** L'adresse du lecteur officiel intégré (sans les commandes Étudium). */
export const urlIntegration = (v: Video) => PLATEFORMES[v.fournisseur].integration(v.id);
