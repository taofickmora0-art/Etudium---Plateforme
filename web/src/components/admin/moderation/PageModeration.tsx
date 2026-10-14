"use client";

import { useRef, useState } from "react";
import { Shield01Icon } from "@hugeicons/core-free-icons";
import { useMaintenant } from "@/components/notifications/horloge";
import { Banner } from "@/components/ui/Banner";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { chargerFile, garderContenu, retablirPublication, supprimerContenu } from "@/lib/moderation/actions";
import type { ElementFile, EtatModeration, OngletFile } from "@/lib/moderation/types";
import { BlocAnalyse } from "./BlocAnalyse";
import { ElementModeration } from "./ElementModeration";

const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const MESSAGES = { garder: "Contenu gardé", supprimer: "Contenu supprimé", retablir: "Publication rétablie" } as const;
const VIDES: Record<OngletFile, { titre: string; texte: string }> = {
  a_examiner: { titre: "Rien à examiner", texte: "Les publications signalées par l’analyse ou par les membres apparaîtront ici." },
  bloquees: { titre: "Aucune publication bloquée", texte: "Les publications refusées par l’analyse automatique apparaîtront ici." },
};

/**
 * La file de modération du back-office (spec de la modération, §5) : le bloc « Analyse automatique », puis « À examiner »
 * et « Bloquées ». Un contenu traité quitte la liste.
 */
export function PageModeration({
  initial,
  nombre,
  etat,
  maintenant: heureServeur,
}: {
  initial: ElementFile[];
  nombre: number;
  etat: EtatModeration;
  maintenant?: string;
}) {
  const { toast } = useToast();
  const maintenant = useMaintenant(heureServeur);
  const [onglet, setOnglet] = useState<OngletFile>("a_examiner");
  const [elements, setElements] = useState(initial);
  const [aExaminer, setAExaminer] = useState(nombre);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Seule la dernière lecture compte : deux changements d'onglet rapprochés ne mélangent pas les listes.
  const demande = useRef(0);

  async function changerOnglet(valeur: string) {
    const cible: OngletFile = valeur === "bloquees" ? "bloquees" : "a_examiner";
    const numero = ++demande.current;
    setOnglet(cible);
    setElements([]);
    setChargement(true);
    setErreur(null);
    const reponse = await chargerFile(cible).catch(() => ({ ok: false as const, message: ECHEC }));
    if (numero !== demande.current) return;
    setChargement(false);
    if (!reponse.ok) {
      setErreur(reponse.message);
      return;
    }
    setElements(reponse.elements);
    if (cible === "a_examiner") setAExaminer(reponse.elements.length);
  }

  async function agir(e: ElementFile, action: "garder" | "supprimer" | "retablir"): Promise<string | null> {
    const cible = e.type === "reponse" ? { reponseId: e.id } : { publicationId: e.id };
    const appel = action === "garder" ? garderContenu(cible) : action === "supprimer" ? supprimerContenu(cible) : retablirPublication(e.id);
    const reponse = await appel.catch(() => ({ ok: false as const, message: ECHEC }));
    if (!reponse.ok) {
      setErreur(reponse.message);
      return reponse.message;
    }
    setErreur(null);
    setElements((liste) => liste.filter((x) => !(x.id === e.id && x.type === e.type)));
    if (onglet === "a_examiner") setAExaminer((n) => Math.max(0, n - 1));
    toast({ tone: "reussite", title: MESSAGES[action] });
    return null;
  }

  const vide = VIDES[onglet];
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <BlocAnalyse etat={etat} maintenant={maintenant} />
      <FilterChips
        label="Choisir la liste"
        options={[
          { value: "a_examiner", label: `À examiner (${aExaminer})` },
          { value: "bloquees", label: "Bloquées" },
        ]}
        value={onglet}
        onValueChange={(v) => void changerOnglet(v)}
      />
      {erreur && <Banner tone="erreur" title={erreur} />}
      {chargement ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : elements.length === 0 ? (
        !erreur && <EmptyState icon={Shield01Icon} title={vide.titre} description={vide.texte} />
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {elements.map((e) => (
            <ElementModeration key={`${onglet}-${e.type}-${e.id}`} element={e} onglet={onglet} maintenant={maintenant} onAgir={(action) => agir(e, action)} />
          ))}
        </div>
      )}
    </div>
  );
}
