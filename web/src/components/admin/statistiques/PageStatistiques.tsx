"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen01Icon, Certificate01Icon, Clock01Icon, CreditCardIcon, CrownIcon, Discount01Icon, TaskDone01Icon, UserAdd01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { Carte, GRILLE_CHIFFRES, RANGEE, Tuile } from "@/components/tableau/Blocs";
import { FilterChips } from "@/components/ui/FilterChips";
import { CELLULE_TABLEAU } from "@/components/ui/TableauListe";
import { Tag } from "@/components/ui/Tag";
import { montantFcfa } from "@/lib/abonnement/regles";
import { cn } from "@/lib/cn";
import { ONGLETS, PERIODES, type OngletStatistiques, type StatistiquesFormation, type StatistiquesPeriode } from "@/lib/statistiques/types";
import { Barres, jourCourt, moisCourt, moisLong, Part } from "./Graphiques";

// La page « Statistiques » (lot 6 A, spec §4.2) : une période (30 jours, 3 mois, 12 mois) et trois onglets, dans
// l'adresse. Le tableau des formations se trie par colonne.

type Periode = "30" | "90" | "365";
const chiffre = (n: number) => n.toLocaleString("fr-FR");
const pourcent = (n: number | null) => (n === null ? "—" : `${n} %`);

/** « 1 h 30 », « 45 min », « 0 min ». */
function duree(secondes: number): string {
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

function colonnesCourbe<T extends { debut: string }>(points: T[], periode: Periode, valeur: (p: T) => number) {
  return points.map((p) => ({
    cle: p.debut,
    court: periode === "365" ? moisCourt(p.debut) : jourCourt(p.debut),
    long: periode === "365" ? moisLong(p.debut) : `semaine du ${jourCourt(p.debut)}`,
    valeurs: [valeur(p)],
  }));
}

const COLONNES_FORMATIONS: { cle: keyof StatistiquesFormation | "titre"; libelle: string; format: (f: StatistiquesFormation) => string }[] = [
  { cle: "suiveurs", libelle: "Étudiants", format: (f) => chiffre(f.suiveurs) },
  { cle: "nouveaux", libelle: "Nouveaux", format: (f) => chiffre(f.nouveaux) },
  { cle: "progression", libelle: "Progression", format: (f) => `${f.progression} %` },
  { cle: "achevement", libelle: "Achèvement", format: (f) => `${f.achevement} %` },
  { cle: "secondesVideo", libelle: "Temps vidéo", format: (f) => duree(f.secondesVideo) },
  { cle: "note", libelle: "Note", format: (f) => (f.note === null ? "—" : `${f.note.toLocaleString("fr-FR")} / 5 (${f.avis})`) },
  { cle: "certificats", libelle: "Certificats", format: (f) => chiffre(f.certificats) },
];

function TableauFormations({ formations }: { formations: StatistiquesFormation[] }) {
  const [tri, setTri] = useState<keyof StatistiquesFormation | null>(null);
  const lignes = tri ? [...formations].sort((a, b) => Number(b[tri] ?? -1) - Number(a[tri] ?? -1)) : [...formations].sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
  if (formations.length === 0) return <p className="m-0 text-sm leading-[22px] text-discret">Aucune formation en ligne.</p>;
  return (
    <div role="region" aria-label="Tableau des formations" tabIndex={0} className="focus-etudium overflow-x-auto rounded-2xl border border-bordure-carte">
      <table aria-label="Formations" className="w-full min-w-[900px] border-collapse text-sm leading-5 text-texte">
        <thead>
          <tr>
            <th scope="col" className="bg-page px-4 py-3.5 text-left text-[13px] font-medium whitespace-nowrap text-ardoise">
              Formation
            </th>
            <th scope="col" className="bg-page px-4 py-3.5 text-left text-[13px] font-medium whitespace-nowrap text-ardoise">
              État
            </th>
            {COLONNES_FORMATIONS.map((c) => (
              <th key={c.cle} scope="col" aria-sort={tri === c.cle ? "descending" : "none"} className="bg-page px-2 py-2 text-left text-[13px] font-medium whitespace-nowrap text-ardoise">
                <button type="button" onClick={() => setTri(c.cle as keyof StatistiquesFormation)} className="focus-etudium cursor-pointer rounded-champ px-2 py-1.5 font-medium hover:bg-panneau">
                  {c.libelle}
                  {tri === c.cle && <span aria-hidden="true"> ↓</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((f) => (
            <tr key={f.id} className="border-t border-bordure-carte">
              <th scope="row" className={`${CELLULE_TABLEAU} text-left font-medium text-encre`}>
                {f.titre}
              </th>
              <td className={CELLULE_TABLEAU}>{f.statut === "desactivee" ? <Tag tone="echoue">Désactivée</Tag> : <Tag tone="valide">Publiée</Tag>}</td>
              {COLONNES_FORMATIONS.map((c) => (
                <td key={c.cle} className={`${CELLULE_TABLEAU} whitespace-nowrap`}>
                  {c.format(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PageStatistiques({ donnees: d, periode, onglet }: { donnees: StatistiquesPeriode; periode: Periode; onglet: OngletStatistiques }) {
  const router = useRouter();
  const aller = (p: Periode, o: OngletStatistiques) => router.replace(`/admin/statistiques?periode=${p}&onglet=${o}`, { scroll: false });
  const e = d.etudiants;
  const b = d.business;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <FilterChips label="Période" options={PERIODES} value={periode} onValueChange={(v) => aller(v as Periode, onglet)} />
      <div role="tablist" aria-label="Statistiques" className="flex flex-wrap gap-1 border-b border-bordure-carte">
        {ONGLETS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={onglet === o.value}
            onClick={() => aller(periode, o.value)}
            className={cn(
              "focus-etudium -mb-px cursor-pointer border-b-2 px-3 py-2.5 text-[15px] leading-[22px] font-medium",
              onglet === o.value ? "border-bleu text-bleu" : "border-transparent text-discret hover:text-encre",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "etudiants" && (
        <div role="tabpanel" aria-label="Étudiants" className="flex min-w-0 flex-col gap-5">
          <div className={GRILLE_CHIFFRES}>
            <Tuile icon={UserAdd01Icon} tone="information" label="Nouveaux inscrits" value={chiffre(e.inscrits)} />
            <Tuile icon={UserMultipleIcon} label="Étudiants actifs" value={chiffre(e.actifs)} hint="une leçon ouverte sur la période" />
            <Tuile icon={BookOpen01Icon} label="Leçons terminées" value={chiffre(e.leconsTerminees)} />
            <Tuile icon={Certificate01Icon} tone="reussite" label="Formations terminées" value={chiffre(e.formationsTerminees)} hint="certificats délivrés" />
            <Tuile icon={TaskDone01Icon} label="Quiz réussis" value={`${chiffre(e.quiz.reussis)} / ${chiffre(e.quiz.passes)}`} hint={e.quiz.passes > 0 ? `${Math.round((100 * e.quiz.reussis) / e.quiz.passes)} % de réussite` : undefined} />
            <Tuile icon={TaskDone01Icon} label="Exercices validés" value={chiffre(e.exercicesValides)} />
            <Tuile icon={Clock01Icon} label="Temps de vidéo regardé" value={duree(e.secondesVideo)}>
              <p className="m-0 mt-1 text-xs leading-[18px] text-discret">Temps mesuré sur les vidéos suivies (YouTube, Vimeo, TikTok, Tella).</p>
            </Tuile>
          </div>
          <Carte titre="Évolution des inscriptions">
            <Barres titre="Évolution des inscriptions" series={[{ nom: "Inscrits", couleur: "bg-bleu" }]} colonnes={colonnesCourbe(e.courbe, periode, (p) => p.nombre)} />
          </Carte>
        </div>
      )}

      {onglet === "formations" && (
        <div role="tabpanel" aria-label="Formations" className="flex min-w-0 flex-col gap-3">
          <TableauFormations formations={d.formations} />
          <p className="m-0 text-xs leading-[18px] text-discret">Temps mesuré sur les vidéos suivies (YouTube, Vimeo, TikTok, Tella). Achèvement : part des étudiants qui ont leur certificat.</p>
        </div>
      )}

      {onglet === "business" && (
        <div role="tabpanel" aria-label="Business" className="flex min-w-0 flex-col gap-5">
          <div className={GRILLE_CHIFFRES}>
            <Tuile icon={CrownIcon} tone="attention" label="Abonnés actifs" value={chiffre(b.abonnesActifs)} hint="aujourd’hui" />
            <Tuile icon={UserAdd01Icon} label="Nouveaux abonnements" value={chiffre(b.nouveaux)} />
            <Tuile icon={UserMultipleIcon} label="Renouvellements" value={chiffre(b.renouvellements)} />
            <Tuile icon={CreditCardIcon} tone="reussite" label="Revenus" value={montantFcfa(b.revenus)} />
            <Tuile icon={UserAdd01Icon} tone="information" label="Conversion" value={pourcent(b.conversion)} hint="des inscrits de la période sont abonnés" />
            <Tuile
              icon={Discount01Icon}
              label="Codes promo"
              value={`${chiffre(b.codesPromo.utilisations)} utilisation${b.codesPromo.utilisations > 1 ? "s" : ""}`}
              hint={`${montantFcfa(b.codesPromo.remise)} de remise`}
            />
          </div>
          <div className={RANGEE}>
            <Carte titre="Évolution des revenus" className="flex-[999_1_420px]">
              <Barres titre="Évolution des revenus" series={[{ nom: "Revenus", couleur: "bg-bleu" }]} colonnes={colonnesCourbe(b.courbe, periode, (p) => p.montant)} format={montantFcfa} />
            </Carte>
            <Carte titre="Formules choisies" className="flex-[1_1_280px]">
              <div className="flex min-w-0 flex-col gap-[18px]">
                {(() => {
                  const total = b.formules.reduce((s, f) => s + f.nombre, 0);
                  return b.formules.map((f) => (
                    <Part key={f.code} nom={f.nom} part={total > 0 ? Math.round((100 * f.nombre) / total) : 0} libelle={`${chiffre(f.nombre)} abonnement${f.nombre > 1 ? "s" : ""}`} />
                  ));
                })()}
              </div>
            </Carte>
          </div>
        </div>
      )}
    </div>
  );
}
