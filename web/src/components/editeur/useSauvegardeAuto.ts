"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { effacerCopie, ecrireCopie, lireCopie } from "@/lib/editeur/copie-locale";
import type { ResultatSauvegarde } from "@/lib/editeur/types";

// La sauvegarde automatique de l'éditeur (fin du lot 4, spec §2.1). 1,5 seconde après la dernière modification, la
// valeur part avec la révision vue ; une seule sauvegarde à la fois (un changement pendant l'envoi repart ensuite, avec
// la révision rendue). Un échec se réessaie après 2, 5 puis 15 secondes, puis toutes les 30 secondes ; hors ligne, on
// attend le retour du réseau.
// Un conflit arrête tout ; un refus attend une correction. Ce qui n'est pas encore confirmé est gardé sur l'appareil,
// et proposé à la réouverture. Rien ne part à l'ouverture.

export type EtatSauvegarde =
  | { type: "a_jour"; le: string | null; brouillon: boolean }
  | { type: "modifie" }
  | { type: "en_cours" }
  | { type: "hors_ligne" }
  | { type: "echec"; message: string }
  | { type: "conflit"; par: string | null }
  | { type: "invalide"; erreurs: Record<string, string> };

type Phase = { type: "repos" } | { type: "en_cours" } | { type: "hors_ligne" } | { type: "echec"; message: string } | { type: "conflit"; par: string | null } | { type: "invalide"; erreurs: Record<string, string> };

type Options<T> = {
  /** La clé de la copie de l'appareil (« lecon:<id> », « formation:<id> »). */
  cle: string;
  valeur: T;
  revisionInitiale: number;
  brouillonInitial: boolean;
  enregistrer: (valeur: T, revision: number) => Promise<ResultatSauvegarde>;
  /** Chaque enregistrement réussi : la révision que l'éditeur connaît maintenant. */
  surEnregistre?: (revision: number) => void;
  delaiMs?: number;
};

const NOUVEAUX_ESSAIS_MS = [2000, 5000, 15000];
/** Après les trois premiers essais, l'éditeur continue d'essayer, à ce rythme, tant que la page est ouverte. */
const ESSAI_SUIVANT_MS = 30_000;
/** Un envoi sans réponse (réseau figé) compte comme un échec au bout de ce délai : il ne bloque plus les suivants. */
const DELAI_ENVOI_MS = 30_000;
const ECHEC = "L’enregistrement n’a pas abouti.";
const hydrate = () => () => {};
const horsLigne = () => typeof navigator !== "undefined" && navigator.onLine === false;

export function useSauvegardeAuto<T>({ cle, valeur, revisionInitiale, brouillonInitial, enregistrer, surEnregistre, delaiMs = 1500 }: Options<T>) {
  const json = JSON.stringify(valeur);
  const [confirme, setConfirme] = useState(json);
  const [phase, setPhase] = useState<Phase>({ type: "repos" });
  const [dernier, setDernier] = useState<{ le: string | null; brouillon: boolean }>({ le: null, brouillon: brouillonInitial });

  const valeurActuelle = useRef(valeur);
  const confirmeActuel = useRef(json);
  const revision = useRef(revisionInitiale);
  const enregistrerActuel = useRef(enregistrer);
  const surEnregistreActuel = useRef(surEnregistre);
  const enCours = useRef(false);
  const relancer = useRef(false);
  const arrete = useRef(false);
  const essais = useRef(0);
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const envoyerActuel = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    valeurActuelle.current = valeur;
    enregistrerActuel.current = enregistrer;
    surEnregistreActuel.current = surEnregistre;
  });

  const envoyer = useCallback(async () => {
    clearTimeout(minuteur.current);
    if (arrete.current) return;
    if (enCours.current) {
      relancer.current = true;
      return;
    }
    const aEnvoyer = valeurActuelle.current;
    const envoye = JSON.stringify(aEnvoyer);
    if (envoye === confirmeActuel.current) return;
    if (horsLigne()) {
      setPhase({ type: "hors_ligne" });
      return;
    }
    enCours.current = true;
    setPhase({ type: "en_cours" });
    let r: ResultatSauvegarde;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    try {
      r = await Promise.race([
        enregistrerActuel.current(aEnvoyer, revision.current),
        new Promise<never>((_, refuser) => {
          minuterie = setTimeout(() => refuser(new Error("Délai dépassé")), DELAI_ENVOI_MS);
        }),
      ]);
    } catch {
      r = { ok: false, code: "echec", message: ECHEC };
    } finally {
      clearTimeout(minuterie);
    }
    enCours.current = false;

    if (r.ok) {
      revision.current = r.revision;
      surEnregistreActuel.current?.(r.revision);
      essais.current = 0;
      confirmeActuel.current = envoye;
      setConfirme(envoye);
      setDernier({ le: r.enregistreLe, brouillon: r.brouillon });
      setPhase({ type: "repos" });
      if (JSON.stringify(valeurActuelle.current) === envoye) effacerCopie(cle);
      else ecrireCopie(cle, valeurActuelle.current, revision.current);
      if (relancer.current || JSON.stringify(valeurActuelle.current) !== envoye) {
        relancer.current = false;
        void envoyerActuel.current();
      }
      return;
    }
    relancer.current = false;
    if (r.code === "conflit") {
      arrete.current = true;
      setPhase({ type: "conflit", par: r.par });
    } else if (r.code === "invalide") {
      setPhase({ type: "invalide", erreurs: r.erreurs });
    } else if (horsLigne()) {
      setPhase({ type: "hors_ligne" });
    } else {
      setPhase({ type: "echec", message: r.message });
      const attente = NOUVEAUX_ESSAIS_MS[essais.current] ?? ESSAI_SUIVANT_MS;
      essais.current += 1;
      minuteur.current = setTimeout(() => void envoyerActuel.current(), attente);
    }
  }, [cle]);

  useEffect(() => {
    envoyerActuel.current = envoyer;
  }, [envoyer]);

  // Chaque modification : la copie de l'appareil, puis l'envoi 1,5 s après la dernière.
  useEffect(() => {
    if (json === confirmeActuel.current && !enCours.current) return;
    ecrireCopie(cle, valeurActuelle.current, revision.current);
    essais.current = 0;
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => void envoyerActuel.current(), delaiMs);
  }, [json, cle, delaiMs]);

  // Le réseau revient : ce qui attendait part. On quitte l'éditeur (lien de l'appli) avant l'envoi : il part quand même.
  useEffect(() => {
    const reprendre = () => void envoyerActuel.current();
    window.addEventListener("online", reprendre);
    return () => {
      window.removeEventListener("online", reprendre);
      clearTimeout(minuteur.current);
      const reste = valeurActuelle.current;
      if (!arrete.current && !enCours.current && JSON.stringify(reste) !== confirmeActuel.current && !horsLigne()) {
        void enregistrerActuel.current(reste, revision.current).then(
          (r) => r.ok && effacerCopie(cle),
          () => {},
        );
      }
    };
  }, [cle]);

  const etat: EtatSauvegarde =
    phase.type === "repos"
      ? json !== confirme
        ? { type: "modifie" }
        : { type: "a_jour", le: dernier.le, brouillon: dernier.brouillon }
      : phase;

  // Fermer l'onglet avec quelque chose à enregistrer : le navigateur demande confirmation.
  const aRetenir = etat.type !== "a_jour";
  useEffect(() => {
    if (!aRetenir) return;
    const retenir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", retenir);
    return () => window.removeEventListener("beforeunload", retenir);
  }, [aRetenir]);

  // La copie de l'appareil trouvée à l'ouverture (autre contenu) : proposée une fois la page affichée. D'une révision
  // plus ancienne (après un conflit, ou une publication par un autre), elle est signalée : la récupérer remplace la
  // version actuelle.
  const [copie] = useState(() => (typeof window === "undefined" ? null : lireCopie<T>(cle)));
  const [valeurInitiale] = useState(json);
  const [decide, setDecide] = useState(false);
  const affiche = useSyncExternalStore(hydrate, () => true, () => false);
  const recuperation =
    affiche && !decide && copie && copie.revision <= revisionInitiale && JSON.stringify(copie.valeur) !== valeurInitiale
      ? { valeur: copie.valeur, le: copie.le, ancienne: copie.revision < revisionInitiale }
      : null;

  const recuperer = useCallback((): T | null => {
    setDecide(true);
    return copie?.valeur ?? null;
  }, [copie]);
  const ignorer = useCallback(() => {
    setDecide(true);
    effacerCopie(cle);
  }, [cle]);
  const enregistrerMaintenant = useCallback(() => envoyerActuel.current(), []);

  return { etat, brouillon: dernier.brouillon, enregistrerMaintenant, recuperation, recuperer, ignorer };
}
