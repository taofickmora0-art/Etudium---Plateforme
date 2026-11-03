"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { actionsLivre, ETATS_LIVRE, TON_ETAT_LIVRE, type ActionLivre } from "@/lib/bibliotheque/regles";
import type { StatutLivre } from "@/lib/bibliotheque/types";
import { FenetresLivre, LIBELLES_ACTIONS_LIVRE } from "./ActionsLivre";

const VARIANTES: Record<ActionLivre, "principal" | "contour" | "dangerDoux"> = { publier: "principal", republier: "principal", archiver: "contour", supprimer: "dangerDoux" };

/**
 * En haut de la fiche d'un livre : son état, et les mêmes actions que le menu ⋮ de sa carte (Publier, Archiver,
 * Republier, Supprimer le brouillon), avec les mêmes fenêtres. Un brouillon supprimé ramène à la liste.
 */
export function BarreEtatLivre({ id, statut }: { id: string; statut: StatutLivre }) {
  const router = useRouter();
  const [fenetre, setFenetre] = useState<ActionLivre | null>(null);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Tag tone={TON_ETAT_LIVRE[statut]}>{ETATS_LIVRE[statut]}</Tag>
      {actionsLivre(statut).map((a) => (
        <Button key={a} type="button" size="sm" variant={VARIANTES[a]} onClick={() => setFenetre(a)}>
          {LIBELLES_ACTIONS_LIVRE[a]}
        </Button>
      ))}
      <FenetresLivre
        id={id}
        fenetre={fenetre}
        onFenetreChange={setFenetre}
        apresReussite={(action) => (action === "supprimer" ? router.push("/admin/bibliotheque") : router.refresh())}
      />
    </span>
  );
}
