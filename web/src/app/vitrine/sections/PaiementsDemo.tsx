"use client";

import { useState } from "react";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { IconButton } from "@/components/ui/IconButton";
import { Pagination } from "@/components/ui/Pagination";
import { Tag } from "@/components/ui/Tag";

type Paiement = { date: string; objet: string; moyen: string; montant: string; reussi: boolean };

const PAIEMENTS: Paiement[] = [
  { date: "14/09/2026", objet: "Formule Standard · 1 mois", moyen: "MTN Mobile Money", montant: "[PRIX]", reussi: true },
  { date: "02/09/2026", objet: "Formation complémentaire · Marketing digital", moyen: "Moov Money", montant: "[PRIX]", reussi: true },
  { date: "14/08/2026", objet: "Formule Basique · 1 mois", moyen: "MTN Mobile Money", montant: "[PRIX]", reussi: false },
];

const COLONNES: Column<Paiement>[] = [
  { key: "date", header: "Date" },
  { key: "objet", header: "Objet" },
  { key: "moyen", header: "Moyen" },
  { key: "montant", header: "Montant", align: "right" },
  { key: "statut", header: "Statut", render: (p) => (p.reussi ? <Tag tone="reussi">Réussi</Tag> : <Tag tone="echoue">Échoué</Tag>) },
  {
    key: "recu",
    header: "Reçu",
    align: "right",
    render: (p) =>
      p.reussi && <IconButton icon={Download04Icon} label={`Télécharger le reçu du ${p.date}`} variant="discret" size="sm" />,
  },
];

/** Tableau des paiements : la pagination change de page pour de vrai (les 3 pages montrent les mêmes lignes). */
export function PaiementsDemo() {
  const [page, setPage] = useState(1);
  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <DataTable caption="Historique des paiements" columns={COLONNES} rows={PAIEMENTS} rowKey={(p) => p.date} />
      <Pagination page={page} pageCount={3} onPageChange={setPage} label="3 paiements" />
    </div>
  );
}
