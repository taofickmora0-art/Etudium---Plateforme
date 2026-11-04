"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { dureeLisible } from "@/lib/vocal/regles";

// La bulle d'une note vocale (spec du 4 novembre 2026) : lecture/pause, l'onde (sa partie lue en couleur, un clic s'y
// place), la durée, la vitesse 1×, 1,5× ou 2×. Une seule note joue à la fois dans la page.

const VITESSES = [1, 1.5, 2] as const;
const INDISPONIBLE = "Cette note vocale n’a pas pu être lue. Rechargez la page.";
/** Une note sans onde (ou très courte) : des barres régulières. */
const ONDE_PLATE = Array.from({ length: 32 }, () => 30);

let enCours: HTMLAudioElement | null = null;

/** « 1× », « 1,5× », « 2× ». */
const libelleVitesse = (v: number) => `${String(v).replace(".", ",")}×`;

export function LecteurVocal({
  dureeMs,
  ondes,
  source,
  mien = false,
  className,
}: {
  dureeMs: number;
  ondes: number[];
  /** Le lien d'écoute, ou la fonction qui le demande au premier appui (messages privés) ; null : indisponible. */
  source: string | null | (() => Promise<string | null>);
  /** Dans sa propre bulle (bleue) : les couleurs s'inversent. */
  mien?: boolean;
  className?: string;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [lecture, setLecture] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [position, setPosition] = useState(0);
  const [vitesse, setVitesse] = useState<(typeof VITESSES)[number]>(1);
  const [erreur, setErreur] = useState<string | null>(null);
  const barres = ondes.length >= 8 ? ondes : ONDE_PLATE;
  const total = Math.max(1, dureeMs);
  const progression = Math.min(1, position / total);

  useEffect(
    () => () => {
      const a = audio.current;
      if (!a) return;
      a.pause();
      if (enCours === a) enCours = null;
    },
    [],
  );

  /** Le lecteur, créé au premier appui (rien n'est téléchargé avant). */
  async function lecteur(): Promise<HTMLAudioElement | null> {
    if (audio.current) return audio.current;
    setChargement(true);
    try {
      const url = typeof source === "function" ? await source() : source;
      if (!url) {
        setErreur(INDISPONIBLE);
        return null;
      }
      const a = new Audio(url);
      a.preload = "auto";
      a.playbackRate = vitesse;
      a.ontimeupdate = () => setPosition(Math.min(total, a.currentTime * 1000));
      a.onended = () => {
        setLecture(false);
        setPosition(0);
      };
      a.onpause = () => setLecture(false);
      a.onplay = () => setLecture(true);
      a.onerror = () => {
        setLecture(false);
        setErreur(INDISPONIBLE);
      };
      audio.current = a;
      return a;
    } catch {
      setErreur(INDISPONIBLE);
      return null;
    } finally {
      setChargement(false);
    }
  }

  async function basculer() {
    setErreur(null);
    const a = await lecteur();
    if (!a) return;
    if (!a.paused) return a.pause();
    if (enCours && enCours !== a) enCours.pause();
    enCours = a;
    try {
      await a.play();
    } catch {
      setLecture(false);
      setErreur(INDISPONIBLE);
    }
  }

  async function allerA(ms: number) {
    const cible = Math.max(0, Math.min(total, ms));
    setPosition(cible);
    const a = await lecteur();
    if (a) a.currentTime = cible / 1000;
  }

  function cliquerOnde(e: PointerEvent<HTMLDivElement>) {
    const zone = e.currentTarget.getBoundingClientRect();
    if (zone.width > 0) void allerA(((e.clientX - zone.left) / zone.width) * total);
  }

  function toucheOnde(e: KeyboardEvent<HTMLDivElement>) {
    const pas = e.key === "ArrowRight" ? 5_000 : e.key === "ArrowLeft" ? -5_000 : 0;
    if (!pas) return;
    e.preventDefault();
    void allerA(position + pas);
  }

  function changerVitesse() {
    const suivante = VITESSES[(VITESSES.indexOf(vitesse) + 1) % VITESSES.length];
    setVitesse(suivante);
    if (audio.current) audio.current.playbackRate = suivante;
  }

  const affichee = lecture || position > 0 ? position : dureeMs;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => void basculer()}
          disabled={chargement}
          aria-label={lecture ? "Mettre en pause la note vocale" : `Écouter la note vocale (${dureeLisible(dureeMs)})`}
          className={cn(
            "focus-etudium flex size-10 flex-none cursor-pointer items-center justify-center rounded-full border-0 transition-colors disabled:cursor-wait disabled:opacity-60 max-sm:size-9",
            mien ? "bg-white text-bleu hover:bg-bleu-clair" : "bg-bleu text-white hover:bg-bleu-survol",
          )}
        >
          <Icon icon={lecture ? PauseIcon : PlayIcon} size={18} />
        </button>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Position dans la note vocale"
          aria-valuemin={0}
          aria-valuemax={Math.round(total / 1000)}
          aria-valuenow={Math.round(position / 1000)}
          aria-valuetext={`${dureeLisible(position)} sur ${dureeLisible(dureeMs)}`}
          onPointerDown={cliquerOnde}
          onKeyDown={toucheOnde}
          className="focus-etudium flex h-8 min-w-[120px] flex-1 cursor-pointer items-center gap-[2px] rounded-puce"
        >
          {barres.map((v, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{ height: `${Math.max(12, v)}%` }}
              className={cn(
                "min-w-[2px] flex-1 rounded-full transition-colors",
                (i + 0.5) / barres.length <= progression ? (mien ? "bg-white" : "bg-bleu") : mien ? "bg-white/45" : "bg-bleu/30",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={changerVitesse}
          aria-label={`Vitesse de lecture : ${libelleVitesse(vitesse)}`}
          className={cn(
            "focus-etudium flex h-7 min-w-10 flex-none cursor-pointer items-center justify-center rounded-full border-0 px-2 text-xs leading-none font-semibold tabular-nums transition-colors",
            mien ? "bg-white/20 text-white hover:bg-white/30" : "bg-coque text-texte hover:bg-coque-survol",
          )}
        >
          {libelleVitesse(vitesse)}
        </button>
      </div>
      <span className={cn("pl-[50px] text-xs leading-[18px] tabular-nums max-sm:pl-[46px]", mien ? "text-white/85" : "text-discret")}>{dureeLisible(affichee)}</span>
      {erreur && (
        <span role="alert" className={cn("text-xs leading-[18px]", mien ? "text-white" : "text-erreur-texte")}>
          {erreur}
        </span>
      )}
    </div>
  );
}
