"use client";

import { useId, useState } from "react";
import { Add01Icon, ArrowDown02Icon, ArrowUp02Icon, Delete02Icon, MoreVerticalIcon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, type MenuEntry } from "@/components/ui/Menu";
import { Tag } from "@/components/ui/Tag";
import { formaterNombre, pluriel, texteVisee } from "@/lib/resultats/affichage";
import { formaterNote, type ResultatEcue, type ResultatUe } from "@/lib/resultats/calcul";
import type { Note, Regles } from "@/lib/resultats/types";
import type { OuvrirFenetre } from "./FenetresResultats";
import { useDeplacer } from "./useDeplacer";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formaterDate = (iso: string) => DATE.format(new Date(`${iso}T00:00:00Z`));

const moyenneOuTiret = (m: number | null) => (m === null ? "—" : formaterNote(m));

/** « Contrôle continu 12,50 · Examen 15,00 (avec rattrapage) », puis ce qui manque encore (« à venir : examen »). */
function detailParType(r: ResultatEcue, avecRattrapage: boolean) {
  const notes = r.categories
    .filter((c) => c.moyenne !== null)
    .map((c) => `${c.nom} ${formaterNote(c.moyenne!)}${c.examen && avecRattrapage ? " (avec rattrapage)" : ""}`);
  const manquants = r.categories.filter((c) => c.moyenne === null).map((c) => c.nom.toLowerCase());
  if (notes.length === 0) return "Pas encore de note";
  return manquants.length ? `${notes.join(" · ")} · à venir : ${manquants.join(", ")}` : notes.join(" · ");
}

type LigneEcueProps = {
  r: ResultatEcue;
  notes: Note[];
  regles: Regles;
  premier: boolean;
  dernier: boolean;
  ouvrir: OuvrirFenetre;
};

function LigneEcue({ r, notes, regles, premier, dernier, ouvrir }: LigneEcueProps) {
  const deplacer = useDeplacer();
  const [ouvertes, setOuvertes] = useState(false);
  const { ecue } = r;
  const siennes = notes.filter((n) => n.ecueId === ecue.id);
  const bareme = ecue.bareme ?? regles.categories;
  const nomType = (n: Note) => (n.rattrapage ? "Rattrapage" : (bareme.find((c) => c.cle === n.categorie)?.nom ?? "Type retiré"));
  const actions: MenuEntry[] = [
    { label: "Modifier l’ECUE", icon: PencilEdit02Icon, onSelect: () => ouvrir({ quoi: "ecue", ueId: ecue.ueId, ecue }) },
    ...(premier ? [] : [{ label: "Monter", icon: ArrowUp02Icon, onSelect: () => void deplacer("ecue", ecue.id, -1) }]),
    ...(dernier ? [] : [{ label: "Descendre", icon: ArrowDown02Icon, onSelect: () => void deplacer("ecue", ecue.id, 1) }]),
    { separator: true },
    {
      label: "Supprimer l’ECUE",
      icon: Delete02Icon,
      danger: true,
      onSelect: () => ouvrir({ quoi: "supprimer", type: "ecue", id: ecue.id, titre: `Supprimer « ${ecue.intitule} » ?`, description: "Ses notes seront supprimées." }),
    },
  ];

  return (
    <li className="border-t border-bordure-carte px-5 py-3.5 max-sm:px-4 max-sm:py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm leading-[22px] font-medium text-encre">
            {ecue.intitule}{" "}
            <span className="font-normal text-discret">· {pluriel(ecue.poids, "crédit")}</span>
          </p>
          <p className="m-0 text-[13px] leading-5 text-discret">{detailParType(r, siennes.some((n) => n.rattrapage))}</p>
          {r.nonClassees > 0 && (
            <p className="m-0 mt-1 text-[13px] leading-5 text-attention-texte">
              {pluriel(r.nonClassees, "note")} d’un type retiré du barème {r.nonClassees > 1 ? "ne comptent" : "ne compte"} pas.
            </p>
          )}
        </div>
        <span className="flex-none text-base leading-6 font-medium text-encre tabular-nums">{moyenneOuTiret(r.moyenne)}</span>
        <Menu label={`Actions sur « ${ecue.intitule} »`} trigger={<IconButton icon={MoreVerticalIcon} label={`Actions sur « ${ecue.intitule} »`} variant="discret" size="sm" />} items={actions} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Button variant="discret" size="sm" iconLeft={Add01Icon} aria-label={`Ajouter une note à « ${ecue.intitule} »`} onClick={() => ouvrir({ quoi: "note", ecue })}>
          Ajouter une note
        </Button>
        {siennes.length > 0 && (
          <Button variant="discret" size="sm" aria-expanded={ouvertes} onClick={() => setOuvertes((o) => !o)}>
            {ouvertes ? "Masquer les notes" : `Voir les notes (${siennes.length})`}
          </Button>
        )}
      </div>
      {ouvertes && (
        <ul className="m-0 mt-1 flex list-none flex-col p-0">
          {siennes.map((n) => (
            <li key={n.id} className="flex items-center gap-3 border-t border-dashed border-bordure-carte py-2 first:border-t-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm leading-5 text-encre">{n.libelle || nomType(n)}</span>
                <span className="block text-xs leading-[18px] text-discret">{[nomType(n), n.date && formaterDate(n.date)].filter(Boolean).join(" · ")}</span>
              </span>
              {n.rattrapage && <Tag tone="enAttente">Rattrapage</Tag>}
              <span className="flex-none text-sm font-medium text-encre tabular-nums">
                {formaterNombre(n.note)}/{formaterNombre(n.sur)}
              </span>
              <Menu
                label={`Actions sur la note « ${n.libelle || nomType(n)} »`}
                trigger={<IconButton icon={MoreVerticalIcon} label={`Actions sur la note « ${n.libelle || nomType(n)} »`} variant="discret" size="sm" />}
                items={[
                  { label: "Modifier la note", icon: PencilEdit02Icon, onSelect: () => ouvrir({ quoi: "note", ecue, note: n }) },
                  {
                    label: "Supprimer la note",
                    icon: Delete02Icon,
                    danger: true,
                    onSelect: () => ouvrir({ quoi: "supprimer", type: "note", id: n.id, titre: "Supprimer cette note ?", description: "Elle ne comptera plus dans les moyennes." }),
                  },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

type CarteUeProps = {
  resultat: ResultatUe;
  notes: Note[];
  regles: Regles;
  /** Le semestre est acquis par compensation : une UE sous le seuil est acquise quand même. */
  compensee: boolean;
  premier: boolean;
  dernier: boolean;
  ouvrir: OuvrirFenetre;
};

/** Une UE du semestre : sa moyenne, ses crédits, son état, « ce qu'il te faut », et ses ECUE avec leurs notes. */
export function CarteUe({ resultat, notes, regles, compensee, premier, dernier, ouvrir }: CarteUeProps) {
  const id = useId();
  const deplacer = useDeplacer();
  const { ue } = resultat;
  const nom = ue.code ? `${ue.code} · ${ue.intitule}` : ue.intitule;
  const visee = texteVisee(resultat.noteVisee, "l’UE");
  const etat =
    resultat.validee === true ? (
      <Tag tone="valide">Validée</Tag>
    ) : resultat.validee === false ? (
      compensee ? <Tag tone="valide">Acquise par compensation</Tag> : <Tag tone="echoue">Non validée</Tag>
    ) : (
      <Tag tone="enAttente">{resultat.moyenne === null ? "Sans note" : "Provisoire"}</Tag>
    );
  const actions: MenuEntry[] = [
    { label: "Modifier l’UE", icon: PencilEdit02Icon, onSelect: () => ouvrir({ quoi: "ue", semestreId: ue.semestreId, ue }) },
    { label: "Ajouter une ECUE", icon: Add01Icon, onSelect: () => ouvrir({ quoi: "ecue", ueId: ue.id }) },
    ...(premier ? [] : [{ label: "Monter", icon: ArrowUp02Icon, onSelect: () => void deplacer("ue", ue.id, -1) }]),
    ...(dernier ? [] : [{ label: "Descendre", icon: ArrowDown02Icon, onSelect: () => void deplacer("ue", ue.id, 1) }]),
    { separator: true },
    {
      label: "Supprimer l’UE",
      icon: Delete02Icon,
      danger: true,
      onSelect: () => ouvrir({ quoi: "supprimer", type: "ue", id: ue.id, titre: `Supprimer « ${nom} » ?`, description: "Ses ECUE et leurs notes seront supprimées." }),
    },
  ];

  return (
    <article aria-labelledby={id} className="rounded-carte border border-bordure-carte bg-panneau">
      <div className="flex items-start gap-3 px-5 pt-4 pb-3.5 max-sm:px-4 max-sm:pt-3.5">
        <div className="min-w-0 flex-1">
          <h3 id={id} className="m-0 text-base leading-6 font-semibold text-pretty text-encre">
            {nom}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] leading-5 text-discret">
            {etat}
            <span>{pluriel(ue.credits, "crédit")}</span>
          </div>
        </div>
        <span className="flex-none text-right">
          <span className="text-2xl leading-8 font-medium text-titre tabular-nums max-sm:text-xl">{moyenneOuTiret(resultat.moyenne)}</span>
          {resultat.moyenne !== null && <span className="text-sm text-discret">/20</span>}
        </span>
        <Menu label={`Actions sur « ${nom} »`} trigger={<IconButton icon={MoreVerticalIcon} label={`Actions sur « ${nom} »`} variant="discret" size="sm" />} items={actions} />
      </div>
      {visee && <p className="m-0 px-5 pb-3 text-sm leading-[22px] font-medium text-bleu max-sm:px-4 max-sm:text-[13px] max-sm:leading-5">{visee}</p>}
      {resultat.ecues.length > 0 && (
        <ul className="m-0 list-none p-0">
          {resultat.ecues.map((r, i) => (
            <LigneEcue key={r.ecue.id} r={r} notes={notes} regles={regles} premier={i === 0} dernier={i === resultat.ecues.length - 1} ouvrir={ouvrir} />
          ))}
        </ul>
      )}
      <div className="border-t border-bordure-carte px-3 py-2">
        <Button variant="discret" size="sm" iconLeft={Add01Icon} onClick={() => ouvrir({ quoi: "ecue", ueId: ue.id })}>
          {resultat.ecues.length ? "Ajouter une ECUE" : "Ajouter sa première ECUE"}
        </Button>
      </div>
    </article>
  );
}
