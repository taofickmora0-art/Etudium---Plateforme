"use client";

import { useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { abandonnerModifications } from "@/lib/editeur/actions";
import { BoutonPublierModifications } from "./FenetrePublication";

/**
 * Une leçon modifiée mais pas encore publiée (fin du lot 4, spec §2.3) : les étudiants voient encore la version en
 * ligne. « Publier les modifications » (toute la formation) ou « Abandonner » (cette leçon seulement).
 */
export function BandeauBrouillon({ formationId, leconId }: { formationId: string; leconId: string }) {
  const { toast } = useToast();
  const [abandon, setAbandon] = useState(false);
  return (
    <>
      <Banner
        tone="attention"
        title="Modifications non publiées."
        action={
          <span className="flex flex-wrap gap-2">
            <BoutonPublierModifications formationId={formationId} />
            <Button size="sm" variant="contour" onClick={() => setAbandon(true)}>
              Abandonner
            </Button>
          </span>
        }
      >
        Les étudiants voient encore la version en ligne.
      </Banner>
      <ConfirmDialog
        open={abandon}
        onOpenChange={setAbandon}
        tone="danger"
        title="Abandonner les modifications de cette leçon ?"
        description="La leçon revient à sa version en ligne. Les modifications non publiées seront perdues."
        confirmLabel="Abandonner"
        onConfirm={async () => {
          const r = await abandonnerModifications(formationId, leconId);
          if (!r.ok) throw new Error(r.message);
          toast({ tone: "reussite", title: "Modifications abandonnées" });
        }}
      />
    </>
  );
}
