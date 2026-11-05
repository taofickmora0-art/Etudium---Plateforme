"use client";

import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { TextInput } from "@/components/ui/TextInput";
import { cn } from "@/lib/cn";
import { detailBareme, formaterNombre, lireNombre, modeleDuBareme } from "@/lib/resultats/affichage";
import { MODELES_BAREME } from "@/lib/resultats/calcul";
import { cleDepuisNom } from "@/lib/resultats/regles";
import type { Categorie } from "@/lib/resultats/types";

type LigneType = { cle: string | null; nom: string; poids: string; examen: boolean };

/** Le choix en cours : un modèle, ou « perso » (les lignes). */
export type EtatBareme = { modele: string; lignes: LigneType[] };

const versLignes = (categories: Categorie[]): LigneType[] => categories.map((c) => ({ cle: c.cle, nom: c.nom, poids: formaterNombre(c.poids), examen: c.examen === true }));

export const etatBareme = (categories: Categorie[]): EtatBareme => ({ modele: modeleDuBareme(categories), lignes: versLignes(categories) });

/** Le barème choisi. Les nouveaux types reçoivent une clé tirée de leur nom. */
export function categoriesDuBareme(etat: EtatBareme): Categorie[] {
  const modele = MODELES_BAREME.find((m) => m.cle === etat.modele);
  if (modele) return modele.categories;
  const prises = etat.lignes.flatMap((l) => (l.cle ? [l.cle] : []));
  return etat.lignes.map((l) => {
    const cle = l.cle ?? cleDepuisNom(l.nom, prises);
    if (!l.cle) prises.push(cle);
    return { cle, nom: l.nom.trim(), poids: lireNombre(l.poids), ...(l.examen ? { examen: true } : {}) };
  });
}

type ChoixBaremeProps = { etat: EtatBareme; onChange: (etat: EtatBareme) => void; name: string };

/** Le barème : un modèle (40/60 par défaut), ou des types personnalisés (6 au plus, 100 % au total, un examen au plus). */
export function ChoixBareme({ etat, onChange, name }: ChoixBaremeProps) {
  const total = etat.lignes.reduce((s, l) => s + (Number.isFinite(lireNombre(l.poids)) ? lireNombre(l.poids) : 0), 0);
  const changerLigne = (i: number, ligne: Partial<LigneType>) =>
    onChange({ ...etat, lignes: etat.lignes.map((l, j) => (j === i ? { ...l, ...ligne } : ligne.examen ? { ...l, examen: false } : l)) });

  const options = [
    ...MODELES_BAREME.map((m) => ({
      value: m.cle,
      label: (
        <>
          {m.nom} <span className="text-discret">· {detailBareme(m.categories)}</span>
        </>
      ),
    })),
    { value: "perso", label: "Personnalisé" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <RadioGroup
        label="Barème"
        showLabel
        name={name}
        options={options}
        value={etat.modele}
        onValueChange={(modele) => {
          // Passer en « Personnalisé » reprend les types déjà composés, sinon le barème affiché, pour le retoucher.
          const depart = MODELES_BAREME.find((m) => m.cle === etat.modele)?.categories;
          const composes = modeleDuBareme(etat.lignes.map((l) => ({ cle: l.cle ?? "", nom: l.nom, poids: lireNombre(l.poids), ...(l.examen ? { examen: true } : {}) }))) === "perso";
          onChange({ modele, lignes: modele === "perso" && depart && !composes ? versLignes(depart) : etat.lignes });
        }}
      />
      {etat.modele === "perso" && (
        <div className="flex flex-col gap-2.5 rounded-champ bg-page p-3">
          {etat.lignes.map((ligne, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <TextInput
                aria-label={`Nom du type ${i + 1}`}
                placeholder="Interrogations"
                maxLength={40}
                value={ligne.nom}
                onChange={(e) => changerLigne(i, { nom: e.target.value })}
                className="min-w-0 flex-[1_1_140px]"
              />
              <span className="flex items-center gap-1.5">
                <TextInput
                  aria-label={`Poids du type ${i + 1} (%)`}
                  inputMode="decimal"
                  value={ligne.poids}
                  onChange={(e) => changerLigne(i, { poids: e.target.value })}
                  className="w-[72px] text-right"
                />
                <span className="text-sm text-discret">%</span>
              </span>
              <Checkbox label="Examen" checked={ligne.examen} onChange={(e) => changerLigne(i, { examen: e.target.checked })} />
              <IconButton
                icon={Delete02Icon}
                label={`Retirer le type ${i + 1}`}
                variant="discret"
                size="sm"
                disabled={etat.lignes.length <= 1}
                onClick={() => onChange({ ...etat, lignes: etat.lignes.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="discret"
              size="sm"
              iconLeft={Add01Icon}
              disabled={etat.lignes.length >= 6}
              onClick={() => onChange({ ...etat, lignes: [...etat.lignes, { cle: null, nom: "", poids: "", examen: false }] })}
            >
              Ajouter un type
            </Button>
            <span className={cn("text-sm", Math.abs(total - 100) > 1e-6 ? "text-erreur-texte" : "text-discret")}>Total : {formaterNombre(total)} %</span>
          </div>
          <p className="m-0 text-xs leading-[18px] text-discret">« Examen » : la note que le rattrapage peut remplacer.</p>
        </div>
      )}
    </div>
  );
}
