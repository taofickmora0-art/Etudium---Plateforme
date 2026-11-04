"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { choisirFormat, DUREE_MAX_MS, DUREE_MIN_MS, resumerOnde, typeDeBase } from "@/lib/vocal/regles";

// L'enregistrement d'une note vocale dans le navigateur (spec du 4 novembre 2026) : le micro (MediaRecorder), l'onde
// mesurée en direct (un niveau toutes les 100 ms), l'arrêt automatique au bout de 5 minutes. La note reste dans le
// navigateur jusqu'à « Envoyer ».

export type EtatEnregistreur = "inactif" | "demande" | "enregistre" | "apercu";

/** La note enregistrée, prête à partir : le fichier, son type sans paramètres, sa durée, son onde et un lien local. */
export type NoteEnregistree = { blob: Blob; type: string; dureeMs: number; ondes: number[]; url: string };

export const MICRO_REFUSE = "Autorisez le micro dans votre navigateur pour enregistrer une note vocale.";
export const MICRO_ABSENT = "Aucun micro n’a été trouvé sur cet appareil.";
export const MICRO_ECHEC = "Le micro n’a pas pu démarrer. Réessayez.";
export const NOTE_TROP_COURTE = "Note trop courte : parlez au moins une seconde.";

const MESURE_MS = 100;
/** Les dernières mesures dessinées pendant l'enregistrement. */
const NIVEAUX_EN_DIRECT = 40;

type Contexte = typeof AudioContext;

/** Le navigateur sait-il enregistrer une note (micro, MediaRecorder et un format connu) ? */
export function vocalPossible(): boolean {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
  return choisirFormat((t) => window.MediaRecorder.isTypeSupported?.(t) ?? false) !== null;
}

function messageMicro(erreur: unknown): string {
  const nom = erreur instanceof DOMException || erreur instanceof Error ? erreur.name : "";
  if (nom === "NotAllowedError" || nom === "SecurityError") return MICRO_REFUSE;
  if (nom === "NotFoundError" || nom === "OverconstrainedError") return MICRO_ABSENT;
  return MICRO_ECHEC;
}

export function useEnregistreurVocal() {
  const [etat, setEtat] = useState<EtatEnregistreur>("inactif");
  const [dureeMs, setDureeMs] = useState(0);
  const [niveaux, setNiveaux] = useState<number[]>([]);
  const [note, setNote] = useState<NoteEnregistree | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const enregistreur = useRef<MediaRecorder | null>(null);
  const flux = useRef<MediaStream | null>(null);
  const contexte = useRef<AudioContext | null>(null);
  const minuterie = useRef<ReturnType<typeof setInterval> | null>(null);
  const morceaux = useRef<Blob[]>([]);
  const mesures = useRef<number[]>([]);
  const debut = useRef(0);
  const garder = useRef(true);
  const fin = useRef<((note: NoteEnregistree | null) => void) | null>(null);
  const urlNote = useRef<string | null>(null);
  // Chaque demande du micro a son numéro : « Supprimer » pendant la demande l'annule (l'accord arrivé après ne lance rien).
  const tentative = useRef(0);

  /** Coupe le micro, l'analyse et la minuterie (l'enregistreur, lui, est arrêté par l'appelant). */
  const liberer = useCallback(() => {
    if (minuterie.current) clearInterval(minuterie.current);
    minuterie.current = null;
    flux.current?.getTracks().forEach((piste) => piste.stop());
    flux.current = null;
    void contexte.current?.close().catch(() => undefined);
    contexte.current = null;
  }, []);

  const oublierNote = useCallback(() => {
    if (urlNote.current) URL.revokeObjectURL(urlNote.current);
    urlNote.current = null;
    setNote(null);
  }, []);

  /** Arrête l'enregistrement : la note (aperçu), ou null si elle est trop courte. */
  const arreter = useCallback((): Promise<NoteEnregistree | null> => {
    const r = enregistreur.current;
    if (!r || r.state === "inactive") return Promise.resolve(note);
    garder.current = true;
    return new Promise((resoudre) => {
      fin.current = resoudre;
      r.stop();
    });
  }, [note]);

  /** Abandonne l'enregistrement en cours ou la note en aperçu. */
  const annuler = useCallback(() => {
    tentative.current += 1;
    garder.current = false;
    const r = enregistreur.current;
    if (r && r.state !== "inactive") r.stop();
    else liberer();
    oublierNote();
    setEtat("inactif");
    setDureeMs(0);
    setNiveaux([]);
  }, [liberer, oublierNote]);

  const demarrer = useCallback(async () => {
    if (etat === "demande" || etat === "enregistre") return;
    setErreur(null);
    oublierNote();
    const format = choisirFormat((t) => window.MediaRecorder?.isTypeSupported?.(t) ?? false);
    if (!format || !navigator.mediaDevices?.getUserMedia) return setErreur(MICRO_ECHEC);
    setEtat("demande");
    const jeton = ++tentative.current;
    let micro: MediaStream;
    try {
      micro = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      if (tentative.current !== jeton) return;
      setEtat("inactif");
      return setErreur(messageMicro(e));
    }
    if (tentative.current !== jeton) {
      micro.getTracks().forEach((piste) => piste.stop());
      return;
    }
    let r: MediaRecorder;
    try {
      r = new MediaRecorder(micro, { mimeType: format, audioBitsPerSecond: 64_000 });
    } catch {
      micro.getTracks().forEach((piste) => piste.stop());
      setEtat("inactif");
      return setErreur(MICRO_ECHEC);
    }
    flux.current = micro;
    enregistreur.current = r;
    morceaux.current = [];
    mesures.current = [];
    garder.current = true;

    // L'onde : le niveau (RMS) du son, toutes les 100 ms. Sans Web Audio, la note part avec une onde plate.
    let analyseur: AnalyserNode | null = null;
    const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Contexte }).webkitAudioContext) as Contexte | undefined;
    if (Ctx) {
      try {
        const ctx = new Ctx();
        analyseur = ctx.createAnalyser();
        analyseur.fftSize = 1024;
        ctx.createMediaStreamSource(micro).connect(analyseur);
        contexte.current = ctx;
      } catch {
        analyseur = null;
      }
    }
    const tampon = new Float32Array(1024);

    r.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) morceaux.current.push(e.data);
    };
    r.onstop = () => {
      const duree = Math.min(DUREE_MAX_MS, Math.round(performance.now() - debut.current));
      liberer();
      enregistreur.current = null;
      const resoudre = fin.current;
      fin.current = null;
      if (!garder.current) {
        resoudre?.(null);
        return;
      }
      if (duree < DUREE_MIN_MS) {
        setEtat("inactif");
        setDureeMs(0);
        setNiveaux([]);
        setErreur(NOTE_TROP_COURTE);
        resoudre?.(null);
        return;
      }
      const type = typeDeBase(r.mimeType || format);
      const blob = new Blob(morceaux.current, { type });
      const url = URL.createObjectURL(blob);
      urlNote.current = url;
      const enregistree: NoteEnregistree = { blob, type, dureeMs: duree, ondes: resumerOnde(mesures.current), url };
      setNote(enregistree);
      setDureeMs(duree);
      setEtat("apercu");
      resoudre?.(enregistree);
    };

    debut.current = performance.now();
    r.start(250);
    setEtat("enregistre");
    setDureeMs(0);
    setNiveaux([]);
    minuterie.current = setInterval(() => {
      const ecoule = performance.now() - debut.current;
      let niveau = 0;
      if (analyseur) {
        analyseur.getFloatTimeDomainData(tampon);
        let somme = 0;
        for (const v of tampon) somme += v * v;
        niveau = Math.sqrt(somme / tampon.length);
      }
      mesures.current.push(niveau);
      setDureeMs(Math.min(DUREE_MAX_MS, Math.round(ecoule)));
      setNiveaux(mesures.current.slice(-NIVEAUX_EN_DIRECT));
      // 5 minutes : l'enregistrement s'arrête seul et attend « Envoyer ».
      if (ecoule >= DUREE_MAX_MS && enregistreur.current?.state === "recording") enregistreur.current.stop();
    }, MESURE_MS);
  }, [etat, liberer, oublierNote]);

  /** La note est partie : tout revient au départ. */
  const terminer = useCallback(() => {
    oublierNote();
    setEtat("inactif");
    setDureeMs(0);
    setNiveaux([]);
    setErreur(null);
  }, [oublierNote]);

  // En quittant la page : le micro se coupe, rien n'est gardé.
  useEffect(
    () => () => {
      tentative.current += 1;
      garder.current = false;
      if (enregistreur.current && enregistreur.current.state !== "inactive") enregistreur.current.stop();
      if (minuterie.current) clearInterval(minuterie.current);
      flux.current?.getTracks().forEach((piste) => piste.stop());
      void contexte.current?.close().catch(() => undefined);
      if (urlNote.current) URL.revokeObjectURL(urlNote.current);
    },
    [],
  );

  return { etat, dureeMs, niveaux, note, erreur, setErreur, demarrer, arreter, annuler, terminer };
}

export type EnregistreurVocal = ReturnType<typeof useEnregistreurVocal>;
