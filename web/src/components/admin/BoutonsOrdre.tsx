"use client";

import { useTransition } from "react";
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { deplacer, type TableOrdonnee } from "@/lib/admin/actions";

type BoutonsOrdreProps = {
  table: TableOrdonnee;
  id: string;
  /** Nom de l'élément, pour les lecteurs d'écran (« Monter « Bases d’Excel » »). */
  nom: string;
  premier: boolean;
  dernier: boolean;
};

/** Monter / descendre un élément dans sa liste ; désactivés au bord. */
export function BoutonsOrdre({ table, id, nom, premier, dernier }: BoutonsOrdreProps) {
  const { toast } = useToast();
  const [enCours, demarrer] = useTransition();
  const bouger = (sens: -1 | 1) =>
    demarrer(async () => {
      let resultat: { ok: boolean; message?: string };
      try {
        resultat = await deplacer(table, id, sens);
      } catch {
        resultat = { ok: false };
      }
      if (!resultat.ok) toast({ tone: "erreur", title: resultat.message ?? "Le déplacement n’a pas abouti." });
    });
  return (
    <span className="flex flex-none gap-1">
      <IconButton icon={ArrowUp01Icon} label={`Monter « ${nom} »`} variant="discret" size="sm" disabled={premier || enCours} onClick={() => bouger(-1)} />
      <IconButton icon={ArrowDown01Icon} label={`Descendre « ${nom} »`} variant="discret" size="sm" disabled={dernier || enCours} onClick={() => bouger(1)} />
    </span>
  );
}
