"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Couverture } from "@/components/ui/Couverture";
import { Heading } from "@/components/ui/Text";
import { useToast } from "@/components/ui/Toast";
import { enregistrerCouverture, retirerCouverture } from "@/lib/admin/actions";
import type { CouleurParcours } from "@/lib/contenus/libelles";
import { verifierCouverture } from "@/lib/couvertures/regles";
import { createClient } from "@/lib/supabase/client";
import { identifiantAleatoire } from "@/lib/identifiant";

const ECHEC_ENVOI = "L’image n’a pas pu être envoyée. Réessayez.";

type Props = {
  formationId: string;
  /** Couleur de la couverture par défaut. */
  parcours: CouleurParcours;
  /** Adresse de l'image actuelle, ou null. */
  couverture: string | null;
};

/**
 * Image de couverture d'une formation (spec des couvertures) : aperçu, envoi, remplacement et retrait. Comme pour les
 * ressources, le navigateur vérifie le vrai format et le poids, dépose le fichier dans l'espace « couvertures », puis
 * l'action l'enregistre sur la formation ; si elle échoue, le fichier déposé est retiré.
 */
export function CouvertureEditor({ formationId, parcours, couverture }: Props) {
  const { toast } = useToast();
  const titre = useId();
  const champ = useRef<HTMLInputElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [retrait, setRetrait] = useState(false);

  const envoyer = async (fichier: File) => {
    setErreur(null);
    const controle = verifierCouverture(fichier, new Uint8Array(await fichier.slice(0, 16).arrayBuffer()));
    if (!controle.ok) {
      setErreur(controle.erreur);
      return;
    }
    const chemin = `${formationId}/${identifiantAleatoire()}.${controle.extension}`;
    setEnvoi(true);
    try {
      const stockage = createClient().storage.from("couvertures");
      // Une copie typée (sans recopier les octets) transmet le type vérifié, celui qu'attend l'espace de stockage.
      const { error } = await stockage.upload(chemin, fichier.slice(0, fichier.size, controle.type), {
        contentType: controle.type,
        upsert: false,
        cacheControl: "31536000",
      });
      if (error) {
        setErreur(ECHEC_ENVOI);
        return;
      }
      let resultat: { ok: boolean; message?: string };
      try {
        resultat = await enregistrerCouverture(formationId, chemin);
      } catch {
        resultat = { ok: false };
      }
      if (!resultat.ok) {
        // Pas de fichier sans formation : le dépôt est retiré.
        await stockage.remove([chemin]);
        setErreur(resultat.message ?? ECHEC_ENVOI);
        return;
      }
      toast({ tone: "reussite", title: "Image de couverture enregistrée." });
    } catch {
      setErreur(ECHEC_ENVOI);
    } finally {
      setEnvoi(false);
      if (champ.current) champ.current.value = "";
    }
  };

  return (
    <section aria-labelledby={titre} className="flex max-w-[680px] flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-6">
      <Heading level="card" as="h2">
        <span id={titre}>Image de couverture</span>
      </Heading>
      <div className="flex flex-wrap items-start gap-5">
        <div className="w-full max-w-[320px] min-w-0 overflow-hidden rounded-carte border border-bordure-carte">
          <Couverture src={couverture} parcours={parcours} sizes="320px" />
        </div>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-3">
          <p className="m-0 text-sm leading-[22px] text-pretty text-discret">JPG, PNG ou WebP, 5 Mo au plus. Conseil : 1280 × 720 pixels.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="contour" loading={envoi} onClick={() => champ.current?.click()}>
              {couverture ? "Remplacer" : "Choisir une image"}
            </Button>
            {couverture && (
              <Button type="button" variant="dangerDoux" disabled={envoi} onClick={() => setRetrait(true)}>
                Retirer
              </Button>
            )}
          </div>
          {erreur && (
            <p role="alert" className="m-0 text-sm leading-[22px] text-pretty text-erreur-texte">
              {erreur}
            </p>
          )}
          <input
            ref={champ}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              if (fichier) void envoyer(fichier);
            }}
          />
        </div>
      </div>
      <ConfirmDialog
        open={retrait}
        onOpenChange={setRetrait}
        title="Retirer l’image de couverture ?"
        description="La formation reprend la couverture par défaut de son parcours."
        tone="danger"
        confirmLabel="Retirer"
        errorMessage="L’image n’a pas pu être retirée. Réessayez."
        onConfirm={async () => {
          const reponse = await retirerCouverture(formationId);
          if (!reponse.ok) throw new Error(reponse.message);
          toast({ tone: "reussite", title: "Image de couverture retirée." });
        }}
      />
    </section>
  );
}
