"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { dureeLecon } from "@/lib/lecon/regles";
import type { VideoLecon } from "@/lib/lecon/types";
import { creerAdaptateur, type Adaptateur, type Evenements } from "@/lib/video/adaptateurs";
import { ajouter, fusionner, observer, pourcentageVu, type EtatSuivi, type Intervalle } from "@/lib/video/suivi";
import { LecteurVideo } from "./LecteurVideo";

type Props = {
  video: VideoLecon;
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
  video,
  titre,
  legende,
  leconId,
  suivre,
  passagesInitiaux,
  reference,
  seuil,
  termineeInitiale,
  creer = creerAdaptateur,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const cadre = useRef<HTMLDivElement>(null);
  const conteneur = useRef<HTMLDivElement>(null);
  const adaptateur = useRef<Adaptateur | null>(null);
  // Passages lus depuis le dernier envoi, et la dernière observation.
  const suivi = useRef<EtatSuivi>({ position: null, instant: 0, passages: [] });
  const commence = useRef<Promise<boolean> | null>(null);
  const termineeRef = useRef(termineeInitiale);
  const enLectureRef = useRef(false);
  const vitesseRef = useRef(1);
  const dureeRef = useRef(reference);

  const [pret, setPret] = useState(false);
  const [echec, setEchec] = useState(false);
  const [enLecture, setEnLecture] = useState(false);
  const [position, setPosition] = useState(0);
  const [duree, setDuree] = useState(reference);
  const [muet, setMuet] = useState(false);
  const [vitesse, setVitesse] = useState(1);
  const [sousTitresDispo, setSousTitresDispo] = useState(false);
  const [sousTitres, setSousTitres] = useState(false);
  const [pleinEcranPossible, setPleinEcranPossible] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [vus, setVus] = useState<Intervalle[]>(() => fusionner(passagesInitiaux));
  const [referenceServeur, setReferenceServeur] = useState(reference);
  const [terminee, setTerminee] = useState(termineeInitiale);

  const commencer = useCallback(() => {
    if (!suivre) return;
    commence.current ??= envoyerAuServeur({ action: "commencer", lecon: leconId })
      .then((r) => r.ok)
      .catch(() => false);
  }, [suivre, leconId]);

  /** Envoie les passages en attente. Un refus de la base les abandonne ; une coupure réseau les garde pour la suite. */
  const envoyer = useCallback(
    async (keepalive = false) => {
      if (!suivre) return;
      const lot = suivi.current.passages;
      if (lot.length === 0 || !commence.current) return;
      suivi.current = { ...suivi.current, passages: [] };
      if (!(await commence.current)) return;
      try {
        const reponse = await envoyerAuServeur(
          { action: "enregistrer", lecon: leconId, passages: lot, position: suivi.current.position ?? 0, duree: dureeRef.current },
          keepalive,
        );
        if (reponse.status === 409) {
          // Refusé (passage trop long, autre onglet…) : on rouvrira le visionnage à la prochaine lecture.
          commence.current = null;
          return;
        }
        if (!reponse.ok) return;
        const resultat = (await reponse.json()) as { reference?: number; terminee?: boolean };
        if (resultat.reference) setReferenceServeur(resultat.reference);
        if (resultat.terminee && !termineeRef.current) {
          termineeRef.current = true;
          setTerminee(true);
          toast({ tone: "reussite", title: "Leçon terminée." });
          router.refresh();
        }
      } catch {
        suivi.current = { ...suivi.current, passages: fusionner([...lot, ...suivi.current.passages]) };
      }
    },
    [suivre, leconId, toast, router],
  );
  const envoyerRef = useRef(envoyer);
  useEffect(() => {
    envoyerRef.current = envoyer;
  }, [envoyer]);

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
          commencer();
          void adaptateur.current?.position().then((p) => {
            suivi.current = { ...suivi.current, position: p, instant: Date.now() };
          });
        } else void envoyerRef.current();
      },
      fin: () => void envoyerRef.current(),
    };
    creer(video, conteneur.current!, evenements)
      .then((a) => {
        if (annule) return a.detruire();
        adaptateur.current = a;
        setPleinEcranPossible(Boolean(document.fullscreenEnabled));
        // L'iframe officielle ne prend ni les clics ni le clavier : les commandes Étudium sont au-dessus.
        conteneur.current?.querySelectorAll("iframe").forEach((f) => {
          f.tabIndex = -1;
          f.title = `Vidéo : ${titre}`;
        });
        void a.duree().then((d) => {
          if (!annule && d > 0) {
            dureeRef.current = d;
            setDuree(d);
          }
        });
        void a.sousTitres().then((oui) => !annule && setSousTitresDispo(oui));
      })
      .catch(() => {
        if (!annule) setEchec(true);
      });
    return () => {
      annule = true;
      void envoyerRef.current(true);
      adaptateur.current?.detruire();
      adaptateur.current = null;
    };
  }, [creer, video, titre, commencer]);

  // Une observation par seconde : position affichée, passages réellement lus.
  useEffect(() => {
    if (!pret) return;
    const minuteur = window.setInterval(async () => {
      const a = adaptateur.current;
      if (!a) return;
      const p = await a.position();
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

  const lire = () => adaptateur.current?.lire();
  const basculer = () => (enLecture ? adaptateur.current?.pause() : lire());

  const ligne = suivre && (
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
        {ligne}
      </div>
    );
  }

  const avance = duree > 0 ? Math.min(100, (100 * position) / duree) : 0;
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div ref={cadre} className="relative aspect-video overflow-hidden rounded-carte bg-encre text-white">
        <div ref={conteneur} aria-hidden="true" className="absolute inset-0 [&_iframe]:pointer-events-none [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:size-full [&_iframe]:border-0" />
        {/* Toute la surface lance ou arrête la vidéo, comme sur un lecteur ordinaire (les boutons restent l'accès clavier). */}
        <div aria-hidden="true" onClick={basculer} className="absolute inset-0 cursor-pointer" />
        {!enLecture && (
          <button
            type="button"
            aria-label="Lire la vidéo"
            onClick={lire}
            className="focus-blanc absolute top-1/2 left-1/2 flex size-[72px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white text-encre"
          >
            <Icon icon={PlayIcon} size={28} />
          </button>
        )}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 bg-linear-to-t from-black/65 to-transparent px-[18px] pt-10 pb-4">
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
    </div>
  );
}
