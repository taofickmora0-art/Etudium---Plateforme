"use client";

import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { lireModificationsEnAttente, publierModifications } from "@/lib/editeur/actions";
import { useEnregistrementsEnAttente } from "@/lib/editeur/en-attente";
import type { ModificationEnAttente } from "@/lib/editeur/types";
import { INDISPONIBLE } from "@/lib/indisponible";

// « Publier les modifications » (fin du lot 4, spec §2.3) : la fenêtre liste ce qui part (informations générales,
// leçons), avec qui l'a modifié et quand ; un clic publie tout d'un coup et crée une version.

const heure = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
};
const ECHEC = "La liste des modifications n’a pas pu être lue. Réessayez.";

function Contenu({ formationId, onFermer }: { formationId: string; onFermer: () => void }) {
  const { toast } = useToast();
  const [liste, setListe] = useState<ModificationEnAttente[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  // Un éditeur de la page n'a pas fini d'enregistrer : ce qu'il garde ne partira pas avec la publication.
  const attente = useEnregistrementsEnAttente();

  useEffect(() => {
    let actif = true;
    lireModificationsEnAttente(formationId)
      .then((r) => {
        if (!actif) return;
        if (r.migrationAbsente) setErreur(INDISPONIBLE);
        else setListe(r.donnees);
      })
      .catch(() => actif && setErreur(ECHEC));
    return () => {
      actif = false;
    };
  }, [formationId]);

  async function publier() {
    setOccupe(true);
    setErreur(null);
    const r = await publierModifications(formationId).catch(() => ({ ok: false as const, message: "La publication n’a pas abouti. Réessayez." }));
    setOccupe(false);
    if (!r.ok) {
      setErreur(r.message ?? "La publication n’a pas abouti. Réessayez.");
      return;
    }
    toast({ tone: "reussite", title: "version" in r && typeof r.version === "number" ? `Modifications publiées : version ${r.version}.` : "Modifications publiées." });
    onFermer();
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onFermer()}
      title="Publier les modifications ?"
      description="Les étudiants verront aussitôt ces modifications. Une version est gardée dans l’historique."
      className="sm:max-w-[520px]"
      footer={
        <>
          <Button variant="contour" onClick={onFermer}>
            Annuler
          </Button>
          <Button loading={occupe} disabled={!liste || liste.length === 0} onClick={() => void publier()}>
            Publier
          </Button>
        </>
      }
    >
      <div className="mt-4 flex flex-col gap-3">
        {erreur && <Banner tone="erreur" title={erreur} />}
        {attente && (
          <Banner tone="attention" title="Une modification n’est pas encore enregistrée.">
            Elle ne partira pas avec cette publication. Attendez « Enregistré », puis publiez.
          </Banner>
        )}
        {liste === null && !erreur && <p className="m-0 text-sm text-discret">Lecture des modifications…</p>}
        {liste?.length === 0 && <p className="m-0 text-sm text-discret">Aucune modification à publier.</p>}
        {liste && liste.length > 0 && (
          <ul aria-label="Modifications à publier" className="m-0 flex list-none flex-col gap-2 p-0">
            {liste.map((m) => (
              <li key={`${m.type}-${m.id}`} className="flex flex-col gap-0.5 rounded-champ border border-bordure-carte px-3 py-2.5">
                <span className="text-sm leading-[22px] font-medium text-encre">{m.type === "formation" ? m.titre : `Leçon ${m.rang ?? ""} : ${m.titre}`}</span>
                {m.modifiePar && (
                  <span className="text-[13px] leading-5 text-discret">{`par ${m.modifiePar}${m.modifieLe ? `, à ${heure(m.modifieLe)}` : ""}`}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

/** Le bouton « Publier les modifications » et sa fenêtre. */
export function BoutonPublierModifications({ formationId, taille = "sm" }: { formationId: string; taille?: "sm" | "md" }) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <Button size={taille} onClick={() => setOuverte(true)}>
        Publier les modifications
      </Button>
      {ouverte && <Contenu formationId={formationId} onFermer={() => setOuverte(false)} />}
    </>
  );
}
