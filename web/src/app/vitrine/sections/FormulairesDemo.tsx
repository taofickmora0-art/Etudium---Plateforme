"use client";

import { useState } from "react";
import { ChoiceCards } from "@/components/ui/ChoiceCards";
import { CodeInput } from "@/components/ui/CodeInput";
import { FileDrop } from "@/components/ui/FileDrop";
import { FileRow } from "@/components/ui/FileRow";

export function CodeDemo() {
  const [code, setCode] = useState("4821");
  return <CodeInput label="Code reçu par e-mail" value={code} onChange={setCode} hint="Le code expire dans 10 minutes." />;
}

const FORMULES = [
  { value: "basique", title: "Basique", subtitle: "1 parcours au choix", price: "[PRIX] FCFA" },
  { value: "standard", title: "Standard", subtitle: "2 parcours au choix", price: "[PRIX] FCFA" },
  { value: "premium", title: "Premium", subtitle: "Tous les parcours", price: "[PRIX] FCFA" },
];

export function FormulesDemo() {
  const [formule, setFormule] = useState("standard");
  return <ChoiceCards label="Choisissez une formule" options={FORMULES} value={formule} onValueChange={setFormule} />;
}

const NOM_LONG = "Memoire_de_fin_d_etudes_Communication_digitale_Universite_d_Abomey-Calavi_version_fin.docx";

function taille(octets: number) {
  return octets < 1024 * 1024 ? `${Math.max(1, Math.round(octets / 1024))} Ko` : `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

/** Dépôt : les fichiers choisis s'ajoutent en tête de liste (rien n'est envoyé). */
export function DepotDemo() {
  const [deposes, setDeposes] = useState<{ id: number; name: string; meta: string }[]>([
    { id: 0, name: "Tableau_ventes.xlsx", meta: "248 Ko · envoyé à l’instant" },
  ]);
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <FileDrop
        accept=".xlsx,.xls,.docx,.doc,.pdf"
        maxSizeLabel="Excel, Word ou PDF, 10 Mo maximum"
        onFiles={(files) =>
          setDeposes((liste) => [
            ...files.map((f, i) => ({ id: Date.now() + i, name: f.name, meta: `${taille(f.size)} · choisi à l’instant` })),
            ...liste,
          ])
        }
      />
      <div className="flex min-w-0 flex-col gap-2.5">
        {deposes.map((f) => (
          <FileRow key={f.id} name={f.name} meta={f.meta} onRemove={() => setDeposes((liste) => liste.filter((x) => x.id !== f.id))} />
        ))}
        <FileRow name="Consignes_exercice.pdf" meta="1,2 Mo · ressource de la leçon" downloadHref="data:text/plain;charset=utf-8,Consignes" />
        <FileRow name="Memoire_chapitre2.docx" meta="" progress={62} />
        <FileRow name={NOM_LONG} meta="3,4 Mo · nom de 90 caractères coupé" />
      </div>
    </div>
  );
}
