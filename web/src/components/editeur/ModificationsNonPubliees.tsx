"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { abandonnerModifications } from "@/lib/editeur/actions";
import { BoutonPublierModifications } from "./FenetrePublication";

/**
 * L'onglet « Publication » d'une formation qui a des brouillons (fin du lot 4, spec §2.3) : les publier tous d'un coup, ou
 * tous les abandonner (la formation revient à ce qui est en ligne).
 */
export function ModificationsNonPubliees({ formationId }: { formationId: string }) {
  const { toast } = useToast();
  const [abandon, setAbandon] = useState(false);
  return (
    <section aria-label="Modifications non publiées" className="flex flex-col gap-3 rounded-champ border border-bordure-carte bg-attention-fond/60 p-4">
      <p className="m-0 text-[15px] leading-6 font-medium text-encre">Des modifications ne sont pas encore publiées.</p>
      <p className="m-0 text-sm leading-[22px] text-texte">Les étudiants voient encore la version en ligne. Publiez-les pour qu’ils voient la nouvelle.</p>
      <div className="flex flex-wrap gap-2">
        <BoutonPublierModifications formationId={formationId} taille="md" />
        <Button variant="contour" onClick={() => setAbandon(true)}>
          Abandonner les modifications
        </Button>
      </div>
      <ConfirmDialog
        open={abandon}
        onOpenChange={setAbandon}
        tone="danger"
        title="Abandonner toutes les modifications ?"
        description="La formation revient à sa version en ligne : les informations générales et les leçons modifiées. Les modifications non publiées seront perdues."
        confirmLabel="Abandonner"
        onConfirm={async () => {
          const r = await abandonnerModifications(formationId);
          if (!r.ok) throw new Error(r.message);
          toast({ tone: "reussite", title: "Modifications abandonnées" });
        }}
      />
    </section>
  );
}
