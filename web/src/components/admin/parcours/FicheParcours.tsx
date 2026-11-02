"use client";

import Link from "next/link";
import { BookOpen01Icon, BubbleChatIcon, Certificate01Icon, PencilEdit01Icon, UserMultipleIcon, Video01Icon } from "@hugeicons/core-free-icons";
import { ParcoursForm } from "@/components/admin/ParcoursForm";
import { GRILLE_CHIFFRES } from "@/components/tableau/Blocs";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { StatCard } from "@/components/ui/StatCard";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { compter, type FicheParcoursDonnees } from "@/lib/admin/parcours-chiffres";
import type { ParcoursAdmin } from "@/lib/admin/types";
import { quandSession } from "@/lib/sessions/regles";
import { dateCourte } from "@/lib/utilisateurs/regles";
import { FormationsDuParcours } from "./FormationsDuParcours";

// La fiche d'un parcours au back-office (demande du 2 novembre 2026) : la vue d'ensemble, ses formations (ranger,
// changer de parcours, ajouter), ses apprenants, ses réglages. `?onglet=` choisit l'onglet ouvert.

export const ONGLETS_PARCOURS = ["ensemble", "formations", "apprenants", "reglages"] as const;
export type OngletParcours = (typeof ONGLETS_PARCOURS)[number];

const chiffre = (n: number) => n.toLocaleString("fr-FR");
const LIEN = "focus-etudium text-sm leading-[22px] font-medium text-bleu no-underline hover:underline";

function VueEnsemble({ fiche }: { fiche: FicheParcoursDonnees }) {
  const c = fiche.chiffres;
  const tuiles = [
    { label: "Formations publiées", valeur: c.formationsPubliees, icon: BookOpen01Icon },
    { label: "Brouillons", valeur: c.formationsBrouillons, icon: PencilEdit01Icon },
    { label: "Apprenants", valeur: c.apprenants, icon: UserMultipleIcon },
    { label: "Certificats", valeur: c.certificats, icon: Certificate01Icon, tone: "reussite" as const },
    { label: "Sessions live à venir", valeur: c.sessionsAVenir, icon: Video01Icon },
    { label: "Publications (30 jours)", valeur: c.publications30j, icon: BubbleChatIcon },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className={GRILLE_CHIFFRES}>
        {tuiles.map((t) => (
          <div key={t.label} data-testid="indicateur-parcours" className="flex min-w-0 flex-col">
            <StatCard className="flex-1" icon={t.icon} tone={t.tone} label={t.label} value={chiffre(t.valeur)} />
          </div>
        ))}
      </div>
      <section aria-labelledby="sessions-parcours" className="flex min-w-0 flex-col gap-3 rounded-carte border border-bordure-carte bg-panneau px-5 py-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="sessions-parcours" className="m-0 text-base leading-6 font-semibold text-encre">
            Prochaines sessions live
          </h2>
          <Link href="/admin/sessions" className={LIEN}>
            Toutes les sessions
          </Link>
        </div>
        {fiche.sessions.length === 0 ? (
          <p className="m-0 text-sm leading-[22px] text-discret">Aucune session programmée pour ce parcours.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {fiche.sessions.map((s, i) => (
              <li key={s.id} className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 ${i > 0 ? "border-t border-separateur" : ""}`}>
                <span className="text-[15px] leading-[22px] font-medium text-encre">{s.titre}</span>
                <span className="text-[13px] leading-5 text-discret">{quandSession(s.debut, undefined, "phrase")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Apprenants({ fiche }: { fiche: FicheParcoursDonnees }) {
  const { total, liste } = fiche.apprenants;
  if (total === 0) return <p className="m-0 text-sm leading-[22px] text-discret">Aucun apprenant pour l’instant : personne n’a encore commencé une formation de ce parcours.</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm leading-[22px] text-discret">
        {liste.length < total ? `${compter(total, "apprenant")} ; les ${chiffre(liste.length)} plus récemment actifs sont listés.` : `${compter(total, "apprenant")}, le plus récemment actif d’abord.`}
      </p>
      <TableauListe nom="Apprenants du parcours" nomCadre="Tableau des apprenants du parcours" colonnes={["Apprenant", "Formations commencées", "Certificats", "Dernière activité"]} largeurMin={640}>
        {liste.map((a) => (
          <tr key={a.id}>
            <td className={CELLULE_TABLEAU}>
              <Link href={`/admin/utilisateurs/${a.id}`} className="focus-etudium font-medium text-encre no-underline hover:underline">
                {a.nom}
              </Link>
            </td>
            <td className={CELLULE_TABLEAU}>{chiffre(a.formations)}</td>
            <td className={CELLULE_TABLEAU}>{chiffre(a.certificats)}</td>
            <td className={`${CELLULE_TABLEAU} text-discret`}>{a.derniereActivite ? dateCourte(a.derniereActivite) : "—"}</td>
          </tr>
        ))}
      </TableauListe>
    </div>
  );
}

export function FicheParcours({
  parcours,
  fiche,
  tousLesParcours,
  ongletInitial = "ensemble",
}: {
  parcours: ParcoursAdmin;
  fiche: FicheParcoursDonnees;
  tousLesParcours: ParcoursAdmin[];
  ongletInitial?: string;
}) {
  const onglet = (ONGLETS_PARCOURS as readonly string[]).includes(ongletInitial) ? ongletInitial : "ensemble";
  return (
    <SegmentedTabs
      label="Sections du parcours"
      defaultValue={onglet}
      keepMounted
      className="gap-5"
      items={[
        { value: "ensemble", label: "Vue d’ensemble", content: <VueEnsemble fiche={fiche} /> },
        { value: "formations", label: "Formations", content: <FormationsDuParcours parcours={parcours} fiche={fiche} tousLesParcours={tousLesParcours} /> },
        { value: "apprenants", label: "Apprenants", content: <Apprenants fiche={fiche} /> },
        {
          value: "reglages",
          label: "Réglages",
          content: (
            <div className="max-w-[680px]">
              <ParcoursForm parcours={parcours} />
            </div>
          ),
        },
      ]}
    />
  );
}
