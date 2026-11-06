import type { VideoLecon } from "@/lib/lecon/types";
import { estMesuree } from "./plateformes";

// Lecteurs officiels de YouTube (IFrame API), de Vimeo (Player SDK), de TikTok et de Tella (messages), derrière une
// interface commune : le lecteur Étudium pose ses propres commandes par-dessus. Les scripts ne se chargent qu'à la
// première vidéo de la page. Les plateformes sans mesure (Loom, ScreenPal, Drive) n'ont pas de lecteur piloté.

export type Evenements = {
  pret(): void;
  etat(enLecture: boolean): void;
  fin(): void;
  /** Des sous-titres arrivent après l'ouverture (YouTube livre les automatiques au lancement de la lecture). */
  sousTitres?(): void;
};

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
  /** La vitesse ne se règle pas (TikTok, Tella) : le bouton n'apparaît pas. */
  vitesseFixe?: boolean;
  detruire(): void;
};

/**
 * Délais au-delà desquels on revient au lecteur officiel intégré : le script (réseau coupé, bloqueur), puis la mise en
 * route du lecteur, plus lente sur un téléphone en connexion mobile.
 */
const ATTENTE_SCRIPT = 15_000;
const ATTENTE_LECTEUR = 30_000;

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
  /** Les modules chargés qui ont des réglages (« captions » quand les sous-titres le sont). */
  getOptions?(): string[];
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

/** Charge un script une seule fois ; échoue après ATTENTE_SCRIPT ou en cas d'erreur réseau. */
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
    const delai = window.setTimeout(echouer, ATTENTE_SCRIPT);
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

/** Ne résout que si `promesse` aboutit avant ATTENTE_LECTEUR. */
const avantDelai = <T>(promesse: Promise<T>) =>
  Promise.race([promesse, new Promise<never>((_, rejeter) => window.setTimeout(() => rejeter(new Error("Lecteur muet")), ATTENTE_LECTEUR))]);

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
  // Les sous-titres restent masqués tant que l'étudiant ne les demande pas (bouton « Sous-titres » d'Étudium).
  let sousTitresVoulus = false;
  const masquerSousTitres = () => {
    try {
      lecteur.unloadModule("captions");
    } catch {
      // Sans module de sous-titres : rien à masquer.
    }
  };
  const pistesSousTitres = () => {
    try {
      const pistes = lecteur.getOption("captions", "tracklist");
      return Array.isArray(pistes) ? pistes : [];
    } catch {
      return [];
    }
  };
  const sousTitresCharges = () => {
    try {
      // Le module s'appelle « captions » (ou « cc » selon les versions du lecteur).
      return lecteur.getOptions?.().some((m) => m === "captions" || m === "cc") ?? false;
    } catch {
      return false;
    }
  };
  let lecteur: LecteurYouTube;
  return avantDelai(
    new Promise<Adaptateur>((resoudre) => {
      lecteur = new Player(cible, {
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
          // YouTube charge ses sous-titres (les automatiques, souvent au lancement de la lecture) : le bouton
          // « Sous-titres » d'Étudium apparaît, et ils restent masqués tant que l'étudiant ne les demande pas.
          onApiChange: () => {
            if (pistesSousTitres().length > 0) ev.sousTitres?.();
            if (!sousTitresVoulus && sousTitresCharges()) masquerSousTitres();
          },
          onStateChange: ({ data }: { data: number }) => {
            // YouTube rallume ses sous-titres au lancement de la lecture (automatiques, langue du navigateur) : on les
            // retire, sauf si l'étudiant les a demandés.
            if (data === 1 && !sousTitresVoulus) masquerSousTitres();
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
        sousTitres: async () => pistesSousTitres().length > 0,
        setSousTitres: (actifs) => {
          sousTitresVoulus = actifs;
          if (actifs) lecteur.loadModule("captions");
          else masquerSousTitres();
        },
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

// ─── Lecteurs pilotés par messages (TikTok, Tella) ──────────────────────────────────────────────────

type Message = Record<string, unknown>;
/** Un message reçu : un objet, ou le même en texte JSON ; null pour le reste. */
function lireMessage(data: unknown): Message | null {
  if (typeof data === "string") {
    try {
      return lireMessage(JSON.parse(data));
    } catch {
      return null;
    }
  }
  return data && typeof data === "object" ? (data as Message) : null;
}
const nombre = (valeur: unknown) => (typeof valeur === "number" && Number.isFinite(valeur) ? valeur : null);

/**
 * La position d'un lecteur par messages : la dernière reçue, avancée du temps écoulé pendant la lecture (une
 * plateforme peut n'envoyer sa position que toutes les quelques secondes), jamais au-delà de la durée.
 */
function horloge() {
  let position = 0;
  let instant = Date.now();
  let enLecture = false;
  let duree = 0;
  return {
    recue(p: number | null, d: number | null) {
      if (p !== null) {
        position = p;
        instant = Date.now();
      }
      if (d !== null) duree = d;
    },
    lecture(oui: boolean) {
      position = this.position();
      instant = Date.now();
      enLecture = oui;
    },
    aller(s: number) {
      position = s;
      instant = Date.now();
    },
    position() {
      const p = enLecture ? position + (Date.now() - instant) / 1000 : position;
      return duree > 0 ? Math.min(p, duree) : p;
    },
    duree: () => duree,
  };
}

/**
 * L'iframe officielle et l'écoute de ses messages : seuls ceux de son origine et de sa fenêtre comptent. `pret`
 * (appelée par `traiter` au message « prêt ») résout l'adaptateur ; au-delà du délai, tout est retiré.
 */
function lecteurParMessages(
  cible: HTMLElement,
  adresse: string,
  origine: string,
  traiter: (message: Message, pret: () => void, echouer: () => void) => void,
  construire: (envoyer: (message: Message) => void, detruire: () => void) => Adaptateur,
): Promise<Adaptateur> {
  const iframe = document.createElement("iframe");
  iframe.src = adresse;
  iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
  cible.appendChild(iframe);
  let ecouter: (e: MessageEvent) => void = () => undefined;
  const detruire = () => {
    window.removeEventListener("message", ecouter);
    iframe.remove();
  };
  const envoyer = (message: Message) => iframe.contentWindow?.postMessage(message, origine);
  const adaptateur = construire(envoyer, detruire);
  return avantDelai(
    new Promise<Adaptateur>((resoudre, rejeter) => {
      let resolu = false;
      ecouter = (e: MessageEvent) => {
        if (e.origin !== origine || e.source !== iframe.contentWindow) return;
        const message = lireMessage(e.data);
        if (!message) return;
        traiter(
          message,
          () => {
            if (resolu) return;
            resolu = true;
            resoudre(adaptateur);
          },
          () => {
            // Une erreur avant « prêt » (vidéo supprimée, privée) : la page montre le lecteur officiel et son message.
            if (resolu) return;
            resolu = true;
            rejeter(new Error("Lecteur en erreur"));
          },
        );
      };
      window.addEventListener("message", ecouter);
    }),
  ).catch((erreur: unknown) => {
    detruire();
    throw erreur;
  });
}

/** TikTok (lecteur « player/v1 », messages « x-tiktok-player ») : ses commandes sont masquées, les nôtres les remplacent. */
function tiktok(id: string, cible: HTMLElement, ev: Evenements): Promise<Adaptateur> {
  const ORIGINE = "https://www.tiktok.com";
  const sansCommandes = "controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&rel=0&music_info=0&description=0&native_context_menu=0&closed_caption=0";
  const temps = horloge();
  return lecteurParMessages(
    cible,
    `${ORIGINE}/player/v1/${id}?${sansCommandes}`,
    ORIGINE,
    (m, pret, echouer) => {
      if (m["x-tiktok-player"] !== true) return;
      if (m.type === "onPlayerReady") {
        pret();
        ev.pret();
      } else if (m.type === "onPlayerError") {
        echouer();
      } else if (m.type === "onStateChange") {
        // 1 : lecture ; 2 : pause ; 0 : fin (-1 : départ, 3 : chargement).
        if (m.value === 1) {
          temps.lecture(true);
          ev.etat(true);
        } else if (m.value === 2) {
          temps.lecture(false);
          ev.etat(false);
        } else if (m.value === 0) {
          temps.lecture(false);
          ev.etat(false);
          ev.fin();
        }
      } else if (m.type === "onCurrentTime") {
        const valeur = lireMessage(m.value);
        temps.recue(nombre(valeur?.currentTime), nombre(valeur?.duration));
      }
    },
    (envoyer, detruire) => {
      const commande = (type: string, value?: unknown) => envoyer({ type, value, "x-tiktok-player": true });
      return {
        lire: () => commande("play"),
        pause: () => commande("pause"),
        aller: (s) => {
          commande("seekTo", s);
          temps.aller(s);
        },
        position: async () => temps.position(),
        duree: async () => temps.duree(),
        setMuet: (muet) => commande(muet ? "mute" : "unMute"),
        setVitesse: () => undefined,
        sousTitres: async () => false,
        setSousTitres: () => undefined,
        vitesseFixe: true,
        detruire,
      };
    },
  );
}

/** Tella (lecteur intégré, messages « ready », « playbackState », « timeUpdate »). */
function tella(id: string, cible: HTMLElement, ev: Evenements): Promise<Adaptateur> {
  const ORIGINE = "https://www.tella.tv";
  const temps = horloge();
  let enLecture = false;
  return lecteurParMessages(
    cible,
    `${ORIGINE}/video/${id}/embed`,
    ORIGINE,
    (m, pret) => {
      if (m.type === "ready") {
        pret();
        ev.pret();
        return;
      }
      if (m.type !== "playbackState" && m.type !== "timeUpdate") return;
      temps.recue(nombre(m.currentTime), nombre(m.duration));
      if (m.type !== "playbackState") return;
      if (m.state === "playing" && !enLecture) {
        enLecture = true;
        temps.lecture(true);
        ev.etat(true);
      } else if (m.state !== "playing" && m.state !== "seeking" && m.state !== "stalled") {
        if (enLecture) {
          enLecture = false;
          temps.lecture(false);
          ev.etat(false);
        }
        // « stopped » au bout de la vidéo : la fin (Tella n'a pas d'événement « ended »).
        if (m.state === "stopped" && temps.duree() > 0 && temps.position() >= temps.duree() - 1) ev.fin();
      }
    },
    (envoyer, detruire) => ({
      lire: () => envoyer({ type: "play" }),
      pause: () => envoyer({ type: "pause" }),
      aller: (s) => {
        envoyer({ type: "seek", time: s });
        temps.aller(s);
      },
      position: async () => temps.position(),
      duree: async () => temps.duree(),
      setMuet: (muet) => envoyer({ type: muet ? "mute" : "unmute" }),
      setVitesse: () => undefined,
      sousTitres: async () => false,
      setSousTitres: () => undefined,
      vitesseFixe: true,
      detruire,
    }),
  );
}

/** Crée le lecteur officiel dans `conteneur` ; échoue si son script ne se charge pas à temps, ou sans mesure possible. */
export async function creerAdaptateur(video: VideoLecon, conteneur: HTMLElement, ev: Evenements): Promise<Adaptateur> {
  if (!estMesuree(video.fournisseur)) throw new Error(`Pas de lecteur piloté pour ${video.fournisseur}.`);
  const cible = document.createElement("div");
  conteneur.appendChild(cible);
  switch (video.fournisseur) {
    case "youtube":
      return youtube(video.id, cible, ev);
    case "tiktok":
      return tiktok(video.id, cible, ev);
    case "tella":
      return tella(video.id, cible, ev);
    default:
      return vimeo(video.id, cible, ev);
  }
}
