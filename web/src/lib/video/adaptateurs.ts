import type { VideoLecon } from "@/lib/lecon/types";

// Lecteurs officiels de YouTube (IFrame API) et de Vimeo (Player SDK), derrière une interface commune : le lecteur
// Étudium pose ses propres commandes par-dessus. Les scripts ne se chargent qu'à la première vidéo de la page.

export type Evenements = { pret(): void; etat(enLecture: boolean): void; fin(): void };

export type Adaptateur = {
  lire(): void;
  pause(): void;
  aller(secondes: number): void;
  position(): Promise<number>;
  duree(): Promise<number>;
  setMuet(muet: boolean): void;
  setVitesse(vitesse: number): void;
  /** La vidéo a-t-elle des sous-titres ? */
  sousTitres(): Promise<boolean>;
  setSousTitres(actifs: boolean): void;
  detruire(): void;
};

/** Délai au-delà duquel on revient au lecteur officiel intégré (réseau lent, bloqueur). */
const ATTENTE = 8000;

type LecteurYouTube = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(secondes: number, chargerPlusLoin: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  mute(): void;
  unMute(): void;
  setPlaybackRate(vitesse: number): void;
  loadModule(module: string): void;
  unloadModule(module: string): void;
  getOption(module: string, option: string): unknown;
  destroy(): void;
};

type LecteurVimeo = {
  ready(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  setCurrentTime(secondes: number): Promise<number>;
  getCurrentTime(): Promise<number>;
  getDuration(): Promise<number>;
  setMuted(muet: boolean): Promise<boolean>;
  setPlaybackRate(vitesse: number): Promise<number>;
  getTextTracks(): Promise<{ language: string }[]>;
  enableTextTrack(langue: string): Promise<unknown>;
  disableTextTrack(): Promise<void>;
  on(evenement: string, rappel: () => void): void;
  destroy(): Promise<void>;
};

declare global {
  interface Window {
    YT?: { Player: new (cible: HTMLElement, options: Record<string, unknown>) => LecteurYouTube };
    onYouTubeIframeAPIReady?: () => void;
    Vimeo?: { Player: new (cible: HTMLElement, options: Record<string, unknown>) => LecteurVimeo };
  }
}

const chargements = new Map<string, Promise<void>>();

/** Charge un script une seule fois ; échoue après ATTENTE ou en cas d'erreur réseau. */
function charger(src: string, dejaLa: () => boolean, attendrePret?: (fini: () => void) => void): Promise<void> {
  if (dejaLa()) return Promise.resolve();
  const existant = chargements.get(src);
  if (existant) return existant;
  const promesse = new Promise<void>((resoudre, rejeter) => {
    const echouer = () => {
      window.clearTimeout(delai);
      chargements.delete(src);
      rejeter(new Error(`Lecteur indisponible : ${src}`));
    };
    const delai = window.setTimeout(echouer, ATTENTE);
    const fini = () => {
      window.clearTimeout(delai);
      resoudre();
    };
    attendrePret?.(fini);
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      if (!attendrePret) fini();
    };
    script.onerror = echouer;
    document.head.appendChild(script);
  });
  chargements.set(src, promesse);
  return promesse;
}

/** Ne résout que si `promesse` aboutit avant ATTENTE. */
const avantDelai = <T>(promesse: Promise<T>) =>
  Promise.race([promesse, new Promise<never>((_, rejeter) => window.setTimeout(() => rejeter(new Error("Lecteur muet")), ATTENTE))]);

async function youtube(id: string, cible: HTMLElement, ev: Evenements): Promise<Adaptateur> {
  await charger(
    "https://www.youtube.com/iframe_api",
    () => Boolean(window.YT?.Player),
    (fini) => {
      const precedent = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        precedent?.();
        fini();
      };
    },
  );
  const Player = window.YT!.Player;
  return avantDelai(
    new Promise<Adaptateur>((resoudre) => {
      const lecteur: LecteurYouTube = new Player(cible, {
        videoId: id,
        host: "https://www.youtube-nocookie.com",
        playerVars: { controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, origin: window.location.origin },
        events: {
          onReady: () => {
            // Le module des sous-titres livre la liste des pistes ; on le décharge aussitôt (sous-titres masqués au départ).
            try {
              lecteur.loadModule("captions");
              lecteur.unloadModule("captions");
            } catch {
              // Sans sous-titres : le bouton n'apparaîtra pas.
            }
            resoudre(adaptateur);
            ev.pret();
          },
          onStateChange: ({ data }: { data: number }) => {
            if (data === 1) ev.etat(true);
            else if (data === 2) ev.etat(false);
            else if (data === 0) {
              ev.etat(false);
              ev.fin();
            }
          },
        },
      });
      const adaptateur: Adaptateur = {
        lire: () => lecteur.playVideo(),
        pause: () => lecteur.pauseVideo(),
        aller: (s) => lecteur.seekTo(s, true),
        position: async () => lecteur.getCurrentTime?.() ?? 0,
        duree: async () => lecteur.getDuration?.() ?? 0,
        setMuet: (muet) => (muet ? lecteur.mute() : lecteur.unMute()),
        setVitesse: (v) => lecteur.setPlaybackRate(v),
        sousTitres: async () => {
          try {
            const pistes = lecteur.getOption("captions", "tracklist");
            return Array.isArray(pistes) && pistes.length > 0;
          } catch {
            return false;
          }
        },
        setSousTitres: (actifs) => (actifs ? lecteur.loadModule("captions") : lecteur.unloadModule("captions")),
        detruire: () => lecteur.destroy(),
      };
    }),
  );
}

const sansErreur = (promesse: Promise<unknown>) => void promesse.catch(() => undefined);

async function vimeo(id: string, cible: HTMLElement, ev: Evenements): Promise<Adaptateur> {
  await charger("https://player.vimeo.com/api/player.js", () => Boolean(window.Vimeo?.Player));
  const [numero, code] = id.split("/");
  // Une vidéo « non répertoriée » se lit avec son code, dans l'adresse du lecteur.
  const source = code ? { url: `https://player.vimeo.com/video/${numero}?h=${code}` } : { id: Number(numero) };
  const lecteur = new window.Vimeo!.Player(cible, { ...source, controls: false, dnt: true, playsinline: true, title: false, byline: false, portrait: false });
  lecteur.on("play", () => ev.etat(true));
  lecteur.on("pause", () => ev.etat(false));
  lecteur.on("ended", () => {
    ev.etat(false);
    ev.fin();
  });
  await avantDelai(lecteur.ready());
  const pistes = await lecteur.getTextTracks().catch(() => []);
  ev.pret();
  return {
    lire: () => sansErreur(lecteur.play()),
    pause: () => sansErreur(lecteur.pause()),
    aller: (s) => sansErreur(lecteur.setCurrentTime(s)),
    position: () => lecteur.getCurrentTime(),
    duree: () => lecteur.getDuration(),
    setMuet: (muet) => sansErreur(lecteur.setMuted(muet)),
    // La vitesse dépend de l'offre Vimeo du propriétaire de la vidéo : un refus est ignoré.
    setVitesse: (v) => sansErreur(lecteur.setPlaybackRate(v)),
    sousTitres: async () => pistes.length > 0,
    setSousTitres: (actifs) => sansErreur(actifs && pistes[0] ? lecteur.enableTextTrack(pistes[0].language) : lecteur.disableTextTrack()),
    detruire: () => sansErreur(lecteur.destroy()),
  };
}

/** Crée le lecteur officiel dans `conteneur` ; échoue si son script ne se charge pas à temps. */
export async function creerAdaptateur(video: VideoLecon, conteneur: HTMLElement, ev: Evenements): Promise<Adaptateur> {
  const cible = document.createElement("div");
  conteneur.appendChild(cible);
  return video.fournisseur === "youtube" ? youtube(video.id, cible, ev) : vimeo(video.id, cible, ev);
}
