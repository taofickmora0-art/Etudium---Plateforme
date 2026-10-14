"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Heading, Lead } from "@/components/ui/Text";
import { chargerSessions, seDesinscrire, sinscrire } from "@/lib/sessions/actions";
import { FENETRE_LIEN_MIN } from "@/lib/sessions/regles";
import type { SessionCarte, VueSessions } from "@/lib/sessions/types";
import { CarteSession } from "./CarteSession";
import { FenetreInscription } from "./FenetreInscription";

const VUES: { value: VueSessions; label: string }[] = [
  { value: "a_venir", label: "À venir" },
  { value: "inscriptions", label: "Mes inscriptions" },
  { value: "passees", label: "Passées" },
];
const estVue = (valeur: string): valeur is VueSessions => VUES.some((v) => v.value === valeur);

const VIDES: Record<VueSessions, { titre: string; texte: string; retour: boolean }> = {
  a_venir: { titre: "Aucune session programmée", texte: "Les prochaines sessions live apparaîtront ici.", retour: false },
  inscriptions: {
    titre: "Aucune inscription pour le moment",
    texte: "Inscrivez-vous à une session live pour la retrouver ici. Un rappel vous sera envoyé la veille et 1 h avant.",
    retour: true,
  },
  passees: { titre: "Aucune session passée", texte: "Les sessions de vos inscriptions apparaîtront ici une fois terminées.", retour: true },
};

// Le lien s'ouvre 10 min avant le début : la page relit l'onglet à ce moment (avec 2 s de marge pour une horloge en
// avance), si c'est dans l'heure.
const MARGE_MS = 2_000;
const HORIZON_MS = 60 * 60_000;

/**
 * La page Événements (design NdEvenements ; spec des sessions live, §4) : à venir, mes inscriptions, passées. Tout
 * compte connecté s'inscrit (rappels, « Mes inscriptions ») et rejoint dès que le lien s'ouvre, inscrit ou non.
 */
export function PageEvenements({ initial }: { initial: SessionCarte[] }) {
  const [vue, setVue] = useState<VueSessions>("a_venir");
  const [sessions, setSessions] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [confirmee, setConfirmee] = useState<SessionCarte | null>(null);
  // Seule la dernière lecture compte : un onglet changé deux fois de suite ne mélange pas les réponses.
  const demande = useRef(0);
  const maintenant = new Date();

  const charger = useCallback(async (v: VueSessions) => {
    const numero = ++demande.current;
    const reponse = await chargerSessions(v);
    if (numero !== demande.current) return;
    if (reponse.ok) {
      setSessions(reponse.sessions);
      setErreur(null);
    } else {
      setErreur(reponse.message);
    }
  }, []);

  useEffect(() => {
    const attentes = sessions
      .filter((s) => s.statut === "programmee" && !s.lien)
      .map((s) => Date.parse(s.debut) - FENETRE_LIEN_MIN * 60_000 - Date.now())
      .filter((ms) => ms > 0 && ms <= HORIZON_MS);
    if (attentes.length === 0) return;
    const minuterie = setTimeout(() => void charger(vue), Math.min(...attentes) + MARGE_MS);
    return () => clearTimeout(minuterie);
  }, [sessions, vue, charger]);

  const changerVue = (valeur: string) => {
    const v = estVue(valeur) ? valeur : "a_venir";
    setVue(v);
    void charger(v);
  };

  const majSession = (id: string, inscrit: boolean) =>
    setSessions((actuelles) => actuelles.map((s) => (s.id === id && s.inscrit !== inscrit ? { ...s, inscrit, inscriptions: Math.max(0, s.inscriptions + (inscrit ? 1 : -1)) } : s)));

  async function inscrire(s: SessionCarte) {
    setOccupe(s.id);
    const reponse = await sinscrire(s.id);
    setOccupe(null);
    if (!reponse.ok) {
      setErreur(reponse.message ?? null);
      return;
    }
    setErreur(null);
    majSession(s.id, true);
    setConfirmee(s);
  }

  async function desinscrire(s: SessionCarte) {
    setOccupe(s.id);
    const reponse = await seDesinscrire(s.id);
    setOccupe(null);
    if (!reponse.ok) {
      setErreur(reponse.message ?? null);
      return;
    }
    setErreur(null);
    majSession(s.id, false);
  }

  const vide = VIDES[vue];
  return (
    <div className="flex min-w-0 flex-col">
      <Heading level="page">Événements</Heading>
      <Lead className="mt-2.5">Sessions live avec vos formateurs, sur Google Meet ou Zoom. Un rappel vous est envoyé la veille et 1 h avant.</Lead>
      <FilterChips className="mt-[21px]" label="Filtrer les événements" options={VUES} value={vue} onValueChange={changerVue} />
      <div className="mt-5 h-px bg-separateur" />
      <div className="mt-8 flex min-w-0 flex-col gap-4">
        {erreur && <Banner tone="erreur" title={erreur} />}
        {sessions.length === 0 ? (
          <EmptyState
            icon={Calendar03Icon}
            title={vide.titre}
            description={vide.texte}
            action={
              vide.retour ? (
                <Button variant="contour" onClick={() => changerVue("a_venir")}>
                  Voir les sessions à venir
                </Button>
              ) : undefined
            }
          />
        ) : (
          sessions.map((s) => (
            <CarteSession
              key={s.id}
              session={s}
              maintenant={maintenant}
              occupe={occupe === s.id}
              onInscrire={(x) => void inscrire(x)}
              onDesinscrire={(x) => void desinscrire(x)}
            />
          ))
        )}
      </div>
      <FenetreInscription session={confirmee} onFermer={() => setConfirmee(null)} />
    </div>
  );
}
