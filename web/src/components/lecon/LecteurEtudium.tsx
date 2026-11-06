"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckmarkCircle02Icon,
  FullScreenIcon,
  MinimizeScreenIcon,
  PauseIcon,
  PlayIcon,
  SubtitleIcon,
  VolumeHighIcon,
  VolumeMute02Icon,
} from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { MetaDot } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { dureeLecon, formatVideo } from "@/lib/lecon/regles";
import { demasquerVideo, type VideoMasquee } from "@/lib/video/masque";
import { aSecoursManuel } from "@/lib/video/plateformes";
import { creerAdaptateur, type Adaptateur, type Evenements } from "@/lib/video/adaptateurs";
import { ajouter, fusionner, observer, pourcentageVu, type EtatSuivi, type Intervalle } from "@/lib/video/suivi";
import { useEtatLecon } from "./EtatLecon";
import { LecteurVideo } from "./LecteurVideo";

type Props = {
  /** La vidéo, l'identifiant brouillé : il n'est pas en clair dans le code de la page (lib/video/masque). */
  video: VideoMasquee;
  titre: string;
  /** « Module 3 · Les tableaux croisés dynamiques », dans la barre du lecteur (ordinateur). */
  legende?: string;
  leconId: string;
  /** Compte connecté : on enregistre le temps regardé. Un visiteur regarde sans que rien ne soit envoyé. */
  suivre: boolean;
  passagesInitiaux: Intervalle[];
  /** Durée de la leçon, en secondes (référence du pourcentage). */
  reference: number;
  seuil: number;
  termineeInitiale: boolean;
  /** Où reprendre la vidéo (dernière position enregistrée), en secondes. */
  positionInitiale?: number;
  /** Remplace la création du lecteur officiel (tests). */
  creer?: typeof creerAdaptateur;
};

const VITESSES = [1, 1.25, 1.5, 2, 0.75];
const libelleVitesse = (v: number) => `${String(v).replace(".", ",")}×`;
const deuxChiffres = (n: number) => String(n).padStart(2, "0");

/** « 04:12 », « 1:02:03 » ; « 00:00 » au début. */
function chrono(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes));
  const h = Math.floor(s / 3600);
  const mm = deuxChiffres(Math.floor((s % 3600) / 60));
  return h > 0 ? `${h}:${mm}:${deuxChiffres(s % 60)}` : `${mm}:${deuxChiffres(s % 60)}`;
}
const enMots = (secondes: number) => dureeLecon(Math.floor(secondes)) || "0 s";

/** Pendant la lecture, les commandes s'effacent après ce délai sans mouvement de la souris sur la vidéo. */
const DELAI_COMMANDES_MS = 2500;

const BOUTON = "focus-blanc flex size-9 flex-none cursor-pointer items-center justify-center rounded-champ text-white transition-colors hover:bg-white/15";

function BoutonLecteur({ label, icone, onClick, presse }: { label: string; icone: IconSvgElement; onClick: () => void; presse?: boolean }) {
  return (
    <button type="button" aria-label={label} aria-pressed={presse} onClick={onClick} className={BOUTON}>
      <Icon icon={icone} size={18} />
    </button>
  );
}

const envoyerAuServeur = (corps: Record<string, unknown>, keepalive = false) =>
  fetch("/api/visionnage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(corps),
    keepalive,
  });

/**
 * Lecteur aux couleurs d'Étudium (NdLecon §2.3) posé sur le lecteur officiel de YouTube ou de Vimeo : lecture, piste,
 * son, vitesse, sous-titres, plein écran. Pour un compte connecté, il mesure les passages réellement regardés et les
 * envoie toutes les 10 s, à la pause, à la fin et en quittant la page ; la base valide la leçon au seuil (spec §5).
 * Si le lecteur officiel ne se charge pas, la vidéo reste lisible dans son lecteur d'origine (sans mesure).
 */
export function LecteurEtudium({
  video: masquee,
  titre,
  legende,
  leconId,
  suivre,
  passagesInitiaux,
  reference,
  seuil,
  termineeInitiale,
  positionInitiale = 0,
  creer = creerAdaptateur,
}: Props) {
  // L'identifiant retrouvé ici, dans le navigateur, juste avant de créer le lecteur officiel.
  const video = useMemo(() => demasquerVideo({ fournisseur: masquee.fournisseur, code: masquee.code }), [masquee.fournisseur, masquee.code]);
  const { fournisseur, id } = video;
  const router = useRouter();
  const { toast } = useToast();
  const cadre = useRef<HTMLDivElement>(null);
  // Les commandes (titre, barre, boutons) : effacées pendant la lecture quand la souris quitte la vidéo ou ne bouge plus.
  const commandes = useRef<HTMLDivElement>(null);
  const minuteurCommandes = useRef<number | undefined>(undefined);
  // Un toucher (téléphone) : quand les commandes sont effacées, il les fait revenir au lieu de mettre en pause.
  const toucher = useRef(false);
  // Le dernier geste vient du clavier : un bouton de la barre qui a le focus la garde visible. Après un clic, le
  // bouton garde aussi le focus, mais la barre doit s'effacer comme d'habitude.
  const auClavier = useRef(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const adaptateur = useRef<Adaptateur | null>(null);
  // Passages lus depuis le dernier envoi, et la dernière observation.
  const suivi = useRef<EtatSuivi>({ position: null, instant: 0, passages: [] });
  const commence = useRef<Promise<boolean> | null>(null);
  const termineeRef = useRef(termineeInitiale);
  // Passages déjà enregistrés par la base : le pourcentage affiché suit la base, pas seulement le navigateur.
  const serveur = useRef<Intervalle[]>(fusionner(passagesInitiaux));
  const titreRef = useRef(titre);
  // Où reprendre. Mis à jour quand le lecteur est détruit (Next garde la page en mémoire et la réaffiche : le lecteur
  // est recréé, et doit repartir de là où on en était, pas de la position du premier affichage).
  const repriseRef = useRef(positionInitiale);
  // Saut à faire au premier « Lire » : sur YouTube, un saut avant la lecture lancerait la vidéo toute seule.
  const sautEnAttente = useRef<number | null>(null);
  // Le bouton de fin (page leçon) apprend ainsi que la leçon est validée.
  const etatLecon = useEtatLecon();
  const marquerRef = useRef(etatLecon?.marquerTerminee);
  const marquerSansMesureRef = useRef(etatLecon?.mesureImpossible);
  const enLectureRef = useRef(false);
  const vitesseRef = useRef(1);
  const dureeRef = useRef(reference);
  // La vraie durée de la vidéo, lue sur le lecteur officiel (0 tant qu'elle est inconnue) : comparée à la durée de la
  // leçon, elle dit si le seuil peut être atteint.
  const dureeLueRef = useRef(0);

  const [pret, setPret] = useState(false);
  const [echec, setEchec] = useState(false);
  const [enLecture, setEnLecture] = useState(false);
  // Sur téléphone, la vidéo est trop basse pour le gros bouton et la barre ensemble : le bouton avant la première
  // lecture, la barre ensuite (comme les lecteurs des applications).
  const [demarre, setDemarre] = useState(false);
  const [position, setPosition] = useState(0);
  const [duree, setDuree] = useState(reference);
  const [muet, setMuet] = useState(false);
  const [vitesse, setVitesse] = useState(1);
  const [sousTitresDispo, setSousTitresDispo] = useState(false);
  // TikTok, Tella : la vitesse ne se règle pas, le bouton n'apparaît pas.
  const [vitesseFixe, setVitesseFixe] = useState(false);
  const [sousTitres, setSousTitres] = useState(false);
  const [pleinEcranPossible, setPleinEcranPossible] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [vus, setVus] = useState<Intervalle[]>(() => fusionner(passagesInitiaux));
  const [referenceServeur, setReferenceServeur] = useState(reference);
  const [terminee, setTerminee] = useState(termineeInitiale);
  const [commandesVisibles, setCommandesVisibles] = useState(true);
  const [dureeVideo, setDureeVideo] = useState(0);

  /** Ouvre le visionnage (une fois). Un échec (coupure réseau, refus) sera retenté au prochain envoi. */
  const commencer = useCallback((): Promise<boolean> => {
    if (!suivre) return Promise.resolve(false);
    if (!commence.current) {
      const demande = envoyerAuServeur({ action: "commencer", lecon: leconId })
        .then((r) => r.ok)
        .catch(() => false);
      commence.current = demande;
      void demande.then((ok) => {
        if (!ok && commence.current === demande) commence.current = null;
      });
    }
    return commence.current;
  }, [suivre, leconId]);
  const commencerRef = useRef(commencer);

  /** Pourcentage affiché : ce que la base a enregistré, plus ce qui attend d'être envoyé. */
  const recalculerVus = () => setVus(fusionner([...serveur.current, ...suivi.current.passages]));

  /** Envoie les passages en attente. Un refus de la base les abandonne ; une coupure réseau les garde pour la suite. */
  const envoyer = useCallback(
    async (keepalive = false) => {
      if (!suivre) return;
      const lot = suivi.current.passages;
      if (lot.length === 0) return;
      suivi.current = { ...suivi.current, passages: [] };
      const remettre = () => {
        suivi.current = { ...suivi.current, passages: fusionner([...lot, ...suivi.current.passages]) };
      };
      if (!(await commencer())) {
        // Visionnage pas encore ouvert (coupure réseau) : le lot attend le prochain envoi.
        remettre();
        return;
      }
      try {
        const reponse = await envoyerAuServeur(
          { action: "enregistrer", lecon: leconId, passages: lot, position: suivi.current.position ?? 0 },
          keepalive,
        );
        if (reponse.status === 409) {
          // Refusé (passages trop longs, autre onglet…) : seuls ces passages sont perdus ; le visionnage repart aussitôt.
          commence.current = null;
          void commencer();
          recalculerVus();
          return;
        }
        if (!reponse.ok) {
          remettre();
          return;
        }
        const resultat = (await reponse.json()) as { reference?: number; terminee?: boolean; passages?: Intervalle[] };
        if (resultat.reference) setReferenceServeur(resultat.reference);
        if (resultat.passages) serveur.current = fusionner(resultat.passages);
        recalculerVus();
        if (resultat.terminee && !termineeRef.current) {
          termineeRef.current = true;
          setTerminee(true);
          marquerRef.current?.();
          toast({ tone: "reussite", title: "Leçon terminée." });
          router.refresh();
        }
      } catch {
        remettre();
      }
    },
    [suivre, leconId, toast, router, commencer],
  );
  const envoyerRef = useRef(envoyer);
  useEffect(() => {
    envoyerRef.current = envoyer;
    commencerRef.current = commencer;
    titreRef.current = titre;
    marquerRef.current = etatLecon?.marquerTerminee;
    marquerSansMesureRef.current = etatLecon?.mesureImpossible;
  }, [envoyer, commencer, titre, etatLecon]);

  /** Une durée lue sur le lecteur officiel : la vraie durée de la vidéo, affichée dans la barre. */
  const dureeConnue = (d: number) => {
    if (d <= 0 || dureeLueRef.current > 0) return;
    dureeLueRef.current = d;
    setDureeVideo(d);
    dureeRef.current = d;
    setDuree(d);
  };
  /** Relit la durée tant qu'elle est inconnue (YouTube la donne parfois à 0 avant la lecture). */
  const relireDuree = (a: Adaptateur) => {
    if (dureeLueRef.current > 0) return;
    void a
      .duree()
      .then(dureeConnue)
      .catch(() => undefined);
  };
  const relireDureeRef = useRef(relireDuree);

  /** Le clavier est dans la barre (Tab) : elle reste visible tant qu'il y est. */
  const clavierDansCommandes = () => auClavier.current && Boolean(commandes.current?.contains(document.activeElement));
  /** Montre les commandes, et les efface après le délai si la vidéo joue (sauf si le clavier y est). */
  const montrerCommandes = () => {
    setCommandesVisibles(true);
    window.clearTimeout(minuteurCommandes.current);
    minuteurCommandes.current = window.setTimeout(() => {
      if (enLectureRef.current && !clavierDansCommandes()) setCommandesVisibles(false);
    }, DELAI_COMMANDES_MS);
  };
  const montrerCommandesRef = useRef(montrerCommandes);
  /** La souris quitte la vidéo : les commandes s'effacent aussitôt pendant la lecture. */
  const cacherCommandes = () => {
    window.clearTimeout(minuteurCommandes.current);
    if (enLectureRef.current && !clavierDansCommandes()) setCommandesVisibles(false);
  };
  useEffect(() => {
    const clavier = () => {
      auClavier.current = true;
    };
    const pointeur = () => {
      auClavier.current = false;
    };
    document.addEventListener("keydown", clavier, true);
    document.addEventListener("pointerdown", pointeur, true);
    return () => {
      window.clearTimeout(minuteurCommandes.current);
      document.removeEventListener("keydown", clavier, true);
      document.removeEventListener("pointerdown", pointeur, true);
    };
  }, []);
  const dureeConnueRef = useRef(dureeConnue);

  useEffect(() => {
    if (positionInitiale > repriseRef.current) repriseRef.current = positionInitiale;
  }, [positionInitiale]);

  // Création du lecteur officiel.
  useEffect(() => {
    let annule = false;
    const evenements: Evenements = {
      pret: () => {
        if (!annule) setPret(true);
      },
      etat: (lecture) => {
        if (annule) return;
        enLectureRef.current = lecture;
        setEnLecture(lecture);
        if (lecture) {
          setDemarre(true);
          montrerCommandesRef.current();
          void commencerRef.current();
          const a = adaptateur.current;
          if (a) {
            relireDureeRef.current(a);
            void a
              .position()
              .then((p) => {
                suivi.current = { ...suivi.current, position: p, instant: Date.now() };
              })
              .catch(() => undefined);
          }
        } else void envoyerRef.current();
      },
      fin: () => {
        // La dernière seconde compte : la dernière observation précède la fin d'au plus une seconde (seuil à 100 %).
        const bout = dureeLueRef.current || dureeRef.current;
        if (bout > 0) {
          const avant = suivi.current;
          suivi.current = observer(avant, { position: bout, instant: Date.now(), vitesse: vitesseRef.current, enLecture: true });
        }
        void envoyerRef.current();
      },
    };
    creer({ fournisseur, id }, conteneur.current!, evenements)
      .then((a) => {
        if (annule) return a.detruire();
        adaptateur.current = a;
        setPleinEcranPossible(Boolean(document.fullscreenEnabled));
        setVitesseFixe(Boolean(a.vitesseFixe));
        // L'iframe officielle ne prend ni les clics ni le clavier : les commandes Étudium sont au-dessus.
        conteneur.current?.querySelectorAll("iframe").forEach((f) => {
          f.tabIndex = -1;
          f.title = `Vidéo : ${titreRef.current}`;
        });
        void a
          .duree()
          .then((d) => {
            if (!annule) dureeConnueRef.current(d);
          })
          .catch(() => undefined);
        // Reprise là où on l'avait laissée : pas pour quelques secondes, ni à quelques secondes de la fin.
        const reprise = repriseRef.current;
        if (reprise > 5) {
          void a
            .duree()
            .then((d) => {
              const fin = d > 0 ? d : dureeRef.current;
              if (!annule && (fin <= 0 || reprise < fin - 10)) {
                sautEnAttente.current = reprise;
                setPosition(reprise);
              }
            })
            .catch(() => undefined);
        }
        void a
          .sousTitres()
          .then((oui) => !annule && setSousTitresDispo(oui))
          .catch(() => undefined);
      })
      .catch(() => {
        if (annule) return;
        setEchec(true);
        // TikTok, Tella : sans leur lecteur, la leçon se termine d'un clic plutôt que de rester impossible.
        if (aSecoursManuel(fournisseur)) marquerSansMesureRef.current?.();
      });
    return () => {
      annule = true;
      // Dernière position connue : c'est là que reprendra le lecteur recréé.
      repriseRef.current = Math.floor(suivi.current.position ?? sautEnAttente.current ?? repriseRef.current);
      sautEnAttente.current = null;
      void envoyerRef.current(true);
      suivi.current = { ...suivi.current, position: null };
      adaptateur.current?.detruire();
      adaptateur.current = null;
      enLectureRef.current = false;
      setPret(false);
      setEnLecture(false);
      setDemarre(false);
    };
    // Une relecture de la page par le serveur donne un nouvel objet `video` : seuls le fournisseur et l'identifiant comptent.
  }, [creer, fournisseur, id]);

  // Une observation par seconde : position affichée, passages réellement lus.
  useEffect(() => {
    if (!pret) return;
    const minuteur = window.setInterval(async () => {
      const a = adaptateur.current;
      if (!a) return;
      relireDureeRef.current(a);
      let p: number;
      try {
        p = await a.position();
      } catch {
        return;
      }
      setPosition(p);
      const avant = suivi.current;
      const apres = observer(avant, { position: p, instant: Date.now(), vitesse: vitesseRef.current, enLecture: enLectureRef.current });
      if (apres.passages !== avant.passages && avant.position !== null) {
        const debut = avant.position;
        setVus((v) => ajouter(v, [debut, p]));
      }
      suivi.current = apres;
    }, 1000);
    return () => window.clearInterval(minuteur);
  }, [pret]);

  // Envoi toutes les 10 s pendant la lecture.
  useEffect(() => {
    if (!enLecture || !suivre) return;
    const minuteur = window.setInterval(() => void envoyerRef.current(), 10_000);
    return () => window.clearInterval(minuteur);
  }, [enLecture, suivre]);

  // En quittant la page ou en la passant en arrière-plan : le dernier passage part quand même.
  useEffect(() => {
    const quitter = () => void envoyerRef.current(true);
    const cachee = () => {
      if (document.visibilityState === "hidden") quitter();
    };
    window.addEventListener("pagehide", quitter);
    document.addEventListener("visibilitychange", cachee);
    const ecran = () => setPleinEcran(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", ecran);
    return () => {
      window.removeEventListener("pagehide", quitter);
      document.removeEventListener("visibilitychange", cachee);
      document.removeEventListener("fullscreenchange", ecran);
    };
  }, []);

  const lire = () => {
    const a = adaptateur.current;
    if (!a) return;
    if (sautEnAttente.current !== null) {
      a.aller(sautEnAttente.current);
      sautEnAttente.current = null;
    }
    a.lire();
  };
  const basculer = () => (enLecture ? adaptateur.current?.pause() : lire());
  const commandesMasquees = enLecture && !commandesVisibles;

  // Le seuil se mesure sur la durée de la leçon : absente, ou plus longue que la vidéo, il ne peut pas être atteint.
  // On le dit au lieu de laisser « Terminer la leçon » grisé sans raison.
  const blocage =
    !suivre || terminee
      ? null
      : referenceServeur <= 0
        ? "La durée de cette vidéo n’est pas indiquée dans la leçon : elle ne peut pas encore être validée. Prévenez le formateur."
        : dureeVideo > 0 && Math.min(Math.floor(dureeVideo), referenceServeur) * 100 < seuil * referenceServeur
          ? `La vidéo dure ${chrono(dureeVideo)}, mais la leçon indique ${chrono(referenceServeur)} : le seuil de ${seuil} % ne peut pas être atteint. Prévenez le formateur.`
          : null;
  const avertissement = blocage && (
    <p role="status" className="m-0 rounded-champ bg-attention-fond px-3 py-2 text-xs leading-[18px] text-attention-texte">
      {blocage}
    </p>
  );

  const ligne = suivre && !echec && (
    <div className="flex flex-wrap items-center gap-[7px] text-xs leading-[18px] text-discret">
      {terminee ? (
        <span className="flex items-center gap-1 font-medium text-reussite-texte">
          <Icon icon={CheckmarkCircle02Icon} size={16} />
          <span>Leçon validée</span>
        </span>
      ) : (
        <span>{`Temps réellement regardé : ${pourcentageVu(vus, referenceServeur)} %`}</span>
      )}
      <MetaDot />
      <span>{`Seuil de validation fixé par la formatrice : ${seuil} %`}</span>
      <MetaDot />
      <span>Avancer dans la barre ne compte pas</span>
    </div>
  );

  if (echec) {
    return (
      <div className="flex min-w-0 flex-col gap-2.5">
        <LecteurVideo video={video} titre={titre} />
        {suivre && (
          <p className="m-0 text-xs leading-[18px] text-discret">
            {aSecoursManuel(video.fournisseur)
              ? "Le temps regardé ne peut pas être mesuré avec ce lecteur : terminez la leçon avec « Terminer la leçon »."
              : "Le temps regardé ne peut pas être mesuré avec ce lecteur. Rechargez la page pour réessayer."}
          </p>
        )}
      </div>
    );
  }

  const avance = duree > 0 ? Math.min(100, (100 * position) / duree) : 0;
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div
        ref={cadre}
        onPointerMove={montrerCommandes}
        // Au toucher, le doigt qui se lève « quitte » la vidéo : seule la souris efface les commandes en sortant.
        onPointerLeave={(e) => e.pointerType !== "touch" && cacherCommandes()}
        // Pas de menu du clic droit sur la vidéo (« Inspecter », « Copier l'adresse »…).
        onContextMenu={(e) => e.preventDefault()}
        className={cn("relative overflow-hidden rounded-carte bg-encre text-white", formatVideo(video))}
      >
        <div ref={conteneur} aria-hidden="true" className="absolute inset-0 [&_iframe]:pointer-events-none [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:size-full [&_iframe]:border-0" />
        {/* Toute la surface lance ou arrête la vidéo, comme sur un lecteur ordinaire (les boutons restent l'accès clavier). */}
        <div
          aria-hidden="true"
          data-surface=""
          onTouchStart={() => {
            toucher.current = true;
          }}
          onClick={() => {
            const auDoigt = toucher.current;
            toucher.current = false;
            if (commandesMasquees && auDoigt) montrerCommandes();
            else basculer();
          }}
          // Commandes effacées : le pointeur aussi, pour ne pas gêner la vidéo.
          className={cn("absolute inset-0 cursor-pointer", commandesMasquees && "cursor-none")}
        />
        {!enLecture && (
          <button
            type="button"
            aria-label="Lire la vidéo"
            onClick={lire}
            className={cn(
              "focus-blanc absolute top-1/2 left-1/2 flex size-[72px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white text-encre",
              demarre && "max-sm:hidden",
            )}
          >
            <Icon icon={PlayIcon} size={28} />
          </button>
        )}
        <div
          ref={commandes}
          data-commandes=""
          data-masquees={commandesMasquees}
          onFocus={montrerCommandes}
          className={cn(
            "absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-linear-to-t from-black/65 to-transparent px-3 pt-6 pb-2 transition-opacity duration-300 sm:gap-2.5 sm:px-[18px] sm:pt-10 sm:pb-4",
            !demarre && "max-sm:hidden",
            commandesMasquees && "pointer-events-none opacity-0",
          )}
        >
          {legende && <span className="truncate text-sm leading-5 font-medium max-lg:hidden">{legende}</span>}
          <div className="relative flex h-4 items-center rounded-full has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-white">
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/28">
              <div className="h-full bg-white" style={{ width: `${avance}%` }} />
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(duree))}
              step={1}
              value={Math.floor(position)}
              onChange={(e) => {
                const s = Number(e.target.value);
                sautEnAttente.current = null;
                adaptateur.current?.aller(s);
                setPosition(s);
              }}
              aria-label="Avancer dans la vidéo"
              aria-valuetext={`${enMots(position)} sur ${enMots(duree)}`}
              className="absolute inset-0 w-full cursor-pointer opacity-0"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3.5">
              <BoutonLecteur label={enLecture ? "Mettre en pause" : "Lancer la lecture"} icone={enLecture ? PauseIcon : PlayIcon} onClick={basculer} />
              <BoutonLecteur
                label={muet ? "Remettre le son" : "Couper le son"}
                icone={muet ? VolumeMute02Icon : VolumeHighIcon}
                onClick={() => {
                  adaptateur.current?.setMuet(!muet);
                  setMuet(!muet);
                }}
              />
              <span className="text-xs leading-[18px] whitespace-nowrap tabular-nums">
                {chrono(position)} / {chrono(duree)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3.5">
              {!vitesseFixe && (
                <button
                  type="button"
                  aria-label={`Vitesse de lecture : ${libelleVitesse(vitesse)}`}
                  onClick={() => {
                    const suivante = VITESSES[(VITESSES.indexOf(vitesse) + 1) % VITESSES.length];
                    adaptateur.current?.setVitesse(suivante);
                    vitesseRef.current = suivante;
                    setVitesse(suivante);
                  }}
                  className={cn(BOUTON, "w-auto min-w-9 px-1.5 text-xs leading-[18px] font-medium")}
                >
                  {libelleVitesse(vitesse)}
                </button>
              )}
              {sousTitresDispo && (
                <BoutonLecteur
                  label="Sous-titres"
                  icone={SubtitleIcon}
                  presse={sousTitres}
                  onClick={() => {
                    adaptateur.current?.setSousTitres(!sousTitres);
                    setSousTitres(!sousTitres);
                  }}
                />
              )}
              {pleinEcranPossible && (
                <BoutonLecteur
                  label={pleinEcran ? "Quitter le plein écran" : "Plein écran"}
                  icone={pleinEcran ? MinimizeScreenIcon : FullScreenIcon}
                  onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void cadre.current?.requestFullscreen())}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {ligne}
      {avertissement}
    </div>
  );
}
