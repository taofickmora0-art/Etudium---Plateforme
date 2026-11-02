"use client";

import { useRef, useState } from "react";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { useToast } from "@/components/ui/Toast";
import type { ObjectifJours } from "@/lib/engagement/types";
import { choisirObjectif } from "@/lib/profile/actions";

const OPTIONS = [3, 5, 7].map((n) => ({ value: String(n), label: `${n} jours` }));
const estObjectif = (n: number): n is ObjectifJours => n === 3 || n === 5 || n === 7;

/**
 * L'objectif de la semaine (lot 6 B, Q3) : 3, 5 ou 7 jours d'apprentissage. Le choix s'enregistre tout de suite ; en cas
 * d'échec, retour au choix enregistré, et on le dit (comme les interrupteurs de l'onglet).
 */
export function ChoixObjectif({ valeur }: { valeur: ObjectifJours }) {
  const { toast } = useToast();
  const [choix, setChoix] = useState<ObjectifJours>(valeur);
  const enregistre = useRef<ObjectifJours>(valeur);

  async function choisir(texte: string) {
    const jours = Number(texte);
    if (!estObjectif(jours) || jours === choix) return;
    setChoix(jours);
    let ok = false;
    try {
      ok = (await choisirObjectif(jours)).ok;
    } catch {
      ok = false;
    }
    if (ok) {
      enregistre.current = jours;
    } else {
      setChoix(enregistre.current);
      toast({ tone: "erreur", title: "L’objectif n’a pas été enregistré.", description: "Vérifiez votre connexion, puis réessayez." });
    }
  }

  return (
    <div className="min-w-0 rounded-carte border border-bordure-carte bg-panneau p-5">
      <h3 className="m-0 text-base leading-6 font-semibold text-encre">Objectif de la semaine</h3>
      <p className="m-0 mt-1 text-[13px] leading-5 text-pretty text-discret">Le nombre de jours d’apprentissage visés chaque semaine, sur votre tableau de bord.</p>
      <RadioGroup label="Objectif de la semaine" name="objectif-jours" options={OPTIONS} value={String(choix)} onValueChange={(v) => void choisir(v)} className="mt-3.5" />
    </div>
  );
}
