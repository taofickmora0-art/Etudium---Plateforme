"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Select } from "@/components/ui/Select";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { Tag } from "@/components/ui/Tag";
import { chargerJournal } from "@/lib/journal/actions";
import {
  CATEGORIES_JOURNAL,
  joursDe,
  PERIODES_JOURNAL,
  type AuteurJournal,
  type CategorieJournal,
  type PageJournal as Page,
  type PeriodeJournal,
} from "@/lib/journal/types";

// Le journal des actions (lot 6 A, spec §2.3) : une ligne par action, les filtres dans l'adresse, « Voir plus ».

type Filtres = { categorie: CategorieJournal | null; auteur: string | null; periode: PeriodeJournal };

const DATE_HEURE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Porto-Novo" });
const COLONNES = ["Date", "Auteur", "Catégorie", "Résumé"];

function adresse(f: Filtres): string {
  const p = new URLSearchParams();
  if (f.categorie) p.set("categorie", f.categorie);
  if (f.auteur) p.set("auteur", f.auteur);
  p.set("periode", f.periode);
  return `/admin/journal?${p.toString()}`;
}

export function PageJournal({ initial, filtres, auteurs }: { initial: Page; filtres: Filtres; auteurs: AuteurJournal[] }) {
  const router = useRouter();
  const idAuteur = useId();
  const [lignes, setLignes] = useState(initial.lignes);
  const [suite, setSuite] = useState(initial.suite);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, demarrer] = useTransition();

  const changer = (nouveaux: Partial<Filtres>) => router.replace(adresse({ ...filtres, ...nouveaux }), { scroll: false });
  const voirPlus = () =>
    demarrer(async () => {
      const page = await chargerJournal({ categorie: filtres.categorie, auteur: filtres.auteur, jours: joursDe(filtres.periode) }, lignes[lignes.length - 1].id);
      if (!page) return setErreur("La suite du journal n’a pas pu être chargée. Réessayez.");
      setErreur(null);
      setLignes((avant) => [...avant, ...page.lignes]);
      setSuite(page.suite);
    });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <FilterChips
          label="Filtrer par catégorie"
          options={[{ value: "toutes", label: "Toutes" }, ...CATEGORIES_JOURNAL.map((c) => ({ value: c.value, label: c.label }))]}
          value={filtres.categorie ?? "toutes"}
          onValueChange={(v) => changer({ categorie: v === "toutes" ? null : (v as CategorieJournal) })}
        />
        <FilterChips label="Filtrer par période" options={PERIODES_JOURNAL} value={filtres.periode} onValueChange={(v) => changer({ periode: v as PeriodeJournal })} />
        <Field label="Auteur" htmlFor={idAuteur} className="w-full max-w-[260px]">
          <Select
            id={idAuteur}
            value={filtres.auteur ?? ""}
            onValueChange={(v) => changer({ auteur: v || null })}
            options={[{ value: "", label: "Tous" }, ...auteurs.map((a) => ({ value: a.id, label: a.nom }))]}
          />
        </Field>
      </div>

      {lignes.length === 0 ? (
        <p className="m-0 rounded-carte border border-bordure-carte bg-panneau px-5 py-8 text-center text-sm leading-[22px] text-discret">Aucune action sur cette période.</p>
      ) : (
        <TableauListe nom="Actions de l’équipe" nomCadre="Tableau du journal" colonnes={COLONNES} largeurMin={720} occupe={chargement}>
          {lignes.map((l) => {
            const categorie = CATEGORIES_JOURNAL.find((c) => c.value === l.categorie);
            return (
              <tr key={l.id} className="border-t border-bordure-carte">
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{DATE_HEURE.format(new Date(l.creeLe))}</td>
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{l.auteurNom}</td>
                <td className={CELLULE_TABLEAU}>{categorie && <Tag tone={categorie.ton}>{categorie.label}</Tag>}</td>
                <td className={`${CELLULE_TABLEAU} min-w-[280px]`}>{l.resume}</td>
              </tr>
            );
          })}
        </TableauListe>
      )}
      {erreur && (
        <p role="alert" className="m-0 text-sm leading-[22px] text-erreur-texte">
          {erreur}
        </p>
      )}
      {suite && lignes.length > 0 && (
        <div>
          <Button type="button" variant="contour" loading={chargement} onClick={voirPlus}>
            Voir plus
          </Button>
        </div>
      )}
    </div>
  );
}
