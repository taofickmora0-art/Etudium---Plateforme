"use client";

import { useState } from "react";
import Link from "next/link";
import { Banner } from "@/components/ui/Banner";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { activerGroupeFormation } from "@/lib/groupes/actions";
import { CHEMINS_GROUPES } from "@/lib/groupes/regles";
import type { GroupeDeFormation } from "@/lib/groupes/types";

const ECHEC = "L’opération n’a pas abouti. Réessayez.";

/**
 * « Groupe de discussion » d'une formation (migration 0075), dans l'onglet « Publication » de sa fiche : son formateur ou
 * l'équipe des contenus l'active ou le désactive, tout de suite (c'est un réglage, il ne passe pas par les brouillons).
 * Désactivé, il est caché aux étudiants et ses messages sont gardés ; réactivé, il rouvre tel quel. L'équipe ouvre les
 * groupes depuis son espace étudiant (`/groupes`), le formateur depuis le sien.
 */
export function ReglageGroupeFormation({ formationId, initial, espace }: { formationId: string; initial: GroupeDeFormation; espace: "admin" | "formateur" }) {
  const { toast } = useToast();
  const [actif, setActif] = useState(initial.actif);
  const [slug, setSlug] = useState(initial.slug);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function changer(valeur: boolean) {
    setOccupe(true);
    setErreur(null);
    setActif(valeur);
    const r = await activerGroupeFormation(formationId, valeur).catch(() => ({ ok: false as const, message: ECHEC }));
    setOccupe(false);
    if (!r.ok) {
      setActif(!valeur);
      setErreur(r.message);
      return;
    }
    setActif(r.actif);
    if (r.slug) setSlug(r.slug);
    toast(
      r.actif
        ? { tone: "reussite", title: "Groupe de discussion activé", description: "Les apprenants inscrits le trouvent dans « Groupes » et sur la fiche de la formation." }
        : { tone: "information", title: "Groupe de discussion désactivé", description: "Il est caché aux étudiants ; ses messages sont gardés." },
    );
  }

  return (
    <section aria-label="Groupe de discussion" className="flex max-w-[680px] flex-col gap-3 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:p-4">
      <Switch
        label="Groupe de discussion"
        description="Les apprenants inscrits peuvent échanger entre eux et avec le formateur dans un groupe dédié."
        checked={actif}
        disabled={occupe || !initial.peutRegler}
        onCheckedChange={(v) => void changer(v)}
      />
      {erreur && <Banner tone="erreur" title={erreur} />}
      {slug && (
        <Link href={CHEMINS_GROUPES[espace === "formateur" ? "formateur" : "etudiant"].groupe(slug)} className="focus-etudium self-start rounded-champ text-sm leading-[22px] font-medium text-bleu no-underline hover:underline">
          {actif ? "Ouvrir le groupe" : "Voir le groupe (désactivé)"}
        </Link>
      )}
    </section>
  );
}
