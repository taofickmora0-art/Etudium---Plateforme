"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { Add01Icon, ArrowRight01Icon, DragDropVerticalIcon, MoreVerticalIcon, Route01Icon } from "@hugeicons/core-free-icons";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Menu } from "@/components/ui/Menu";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { ajouterFormationParcours, changerParcoursFormation, rangerFormationParcours } from "@/lib/admin/actions";
import { compter, type FicheParcoursDonnees, type FormationDuParcours, type StatutFormationParcours } from "@/lib/admin/parcours-chiffres";
import type { ParcoursAdmin } from "@/lib/admin/types";
import { STATUTS } from "@/lib/contenus/libelles";

// L'onglet « Formations » de la fiche d'un parcours (demande du 2 novembre 2026) : ses formations dans l'ordre du
// parcours, à ranger en les faisant glisser, à changer de parcours ; et l'ajout d'une formation existante.

const TONS: Record<StatutFormationParcours, TagTone> = { publiee: "valide", brouillon: "enAttente", desactivee: "aCorriger", archivee: "verrouillee" };

function Ligne({ formation: f, rang, onChanger }: { formation: FormationDuParcours; rang: number; onChanger: (f: FormationDuParcours) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex min-h-16 items-center gap-3 border-t border-bordure-carte bg-panneau px-3 py-3 first:border-t-0 max-sm:gap-2 ${isDragging ? "relative z-10 rounded-champ shadow-menu" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Déplacer « ${f.titre} »`}
        className="focus-etudium flex size-8 flex-none cursor-grab touch-none items-center justify-center rounded-champ text-discret hover:bg-coque active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <Icon icon={DragDropVerticalIcon} size={18} />
      </button>
      <span aria-hidden="true" className="w-5 flex-none text-center text-xs leading-[18px] text-discret">
        {rang}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/formations/${f.id}`} className="focus-etudium text-[15px] leading-[22px] font-medium wrap-anywhere text-encre no-underline hover:underline">
            {f.titre}
          </Link>
          <Tag tone={TONS[f.statut]}>{STATUTS[f.statut]}</Tag>
        </span>
        <span className="text-[13px] leading-5 text-discret">{`${compter(f.apprenants, "apprenant")} · ${compter(f.certificats, "certificat")}`}</span>
        {f.autresParcours.length > 0 && <span className="text-xs leading-[18px] text-discret">{`Aussi dans : ${f.autresParcours.join(", ")}`}</span>}
      </span>
      <Menu
        label={`Actions pour ${f.titre}`}
        trigger={<IconButton icon={MoreVerticalIcon} label={`Actions pour ${f.titre}`} variant="discret" size="sm" />}
        items={[
          { label: "Changer de parcours…", icon: Route01Icon, onSelect: () => onChanger(f) },
          { label: "Ouvrir la formation", icon: ArrowRight01Icon, href: `/admin/formations/${f.id}` },
        ]}
        rendreLeFocus={() => false}
      />
    </li>
  );
}

export function FormationsDuParcours({ parcours, fiche, tousLesParcours }: { parcours: ParcoursAdmin; fiche: FicheParcoursDonnees; tousLesParcours: ParcoursAdmin[] }) {
  const { toast } = useToast();
  const idGlisser = useId();
  const idAjout = useId();
  const [ordre, setOrdre] = useState(() => fiche.formations.map((f) => f.id));
  const parId = new Map(fiche.formations.map((f) => [f.id, f]));
  // L'ordre de la base dès qu'elle en renvoie un autre (une formation ajoutée ou partie).
  const ids = ordre.length === fiche.formations.length && ordre.every((id) => parId.has(id)) ? ordre : fiche.formations.map((f) => f.id);

  const [aChanger, setAChanger] = useState<FormationDuParcours | null>(null);
  const [cible, setCible] = useState("");
  const [ajout, setAjout] = useState(false);
  const [aAjouter, setAAjouter] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const boutonAjout = useRef<HTMLButtonElement>(null);
  const autres = tousLesParcours.filter((p) => p.id !== parcours.id);

  const capteurs = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nomDe = (id: UniqueIdentifier) => `« ${parId.get(String(id))?.titre ?? ""} »`;
  const annonces: Announcements = {
    onDragStart: ({ active }) => `${nomDe(active.id)} saisie.`,
    onDragOver: ({ active, over }) => (over ? `${nomDe(active.id)} à la place de ${nomDe(over.id)}.` : `${nomDe(active.id)} hors de la liste.`),
    onDragEnd: ({ active, over }) => (over ? `${nomDe(active.id)} déposée à la place de ${nomDe(over.id)}.` : `${nomDe(active.id)} reposée à sa place.`),
    onDragCancel: ({ active }) => `Déplacement de ${nomDe(active.id)} annulé.`,
  };

  async function deposer({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const avant = ids;
    const apres = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setOrdre(apres);
    const r = await rangerFormationParcours(parcours.id, String(active.id), apres.indexOf(String(active.id)) + 1).catch(() => ({ ok: false as const, message: undefined }));
    if (!r.ok) {
      setOrdre(avant);
      toast({ tone: "erreur", title: r.message ?? "Le déplacement n’a pas abouti." });
    }
  }

  const ouvrirChangement = (f: FormationDuParcours) => {
    setErreur(null);
    setCible("");
    setAChanger(f);
  };

  async function changer() {
    if (!aChanger) return;
    if (!cible) return setErreur("Choisissez un parcours.");
    setOccupe(true);
    const r = await changerParcoursFormation(aChanger.id, parcours.id, cible).catch(() => ({ ok: false as const, message: undefined }));
    setOccupe(false);
    if (!r.ok) return setErreur(r.message ?? "Le changement de parcours n’a pas abouti. Réessayez.");
    const vers = autres.find((p) => p.id === cible)?.nom ?? "";
    toast({ tone: "reussite", title: `« ${aChanger.titre} » est maintenant dans « ${vers} ».` });
    setAChanger(null);
  }

  async function ajouter() {
    if (!aAjouter) return setErreur("Choisissez une formation.");
    setOccupe(true);
    const r = await ajouterFormationParcours(parcours.id, aAjouter).catch(() => ({ ok: false as const, message: undefined }));
    setOccupe(false);
    if (!r.ok) return setErreur(r.message ?? "L’ajout n’a pas abouti. Réessayez.");
    const titre = fiche.aAjouter.find((f) => f.id === aAjouter)?.titre ?? "";
    toast({ tone: "reussite", title: `« ${titre} » est ajoutée au parcours.` });
    setAjout(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm leading-[22px] text-discret">
          {fiche.formations.length > 0 ? `${compter(fiche.formations.length, "formation")}, dans l’ordre du parcours : faites glisser pour le changer.` : "Aucune formation dans ce parcours pour l’instant."}
        </p>
        {fiche.aAjouter.length > 0 && (
          <Button
            ref={boutonAjout}
            variant="contour"
            size="sm"
            iconLeft={Add01Icon}
            onClick={() => {
              setErreur(null);
              setAAjouter("");
              setAjout(true);
            }}
          >
            Ajouter une formation
          </Button>
        )}
      </div>

      {fiche.formations.length > 0 && (
        <DndContext
          id={idGlisser}
          sensors={capteurs}
          collisionDetection={closestCenter}
          onDragEnd={(e) => void deposer(e)}
          accessibility={{
            announcements: annonces,
            screenReaderInstructions: {
              draggable: "Pour déplacer cette formation, appuyez sur Espace ou Entrée, choisissez sa place avec les flèches, puis Espace ou Entrée pour la déposer, ou Échap pour annuler.",
            },
          }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul aria-label="Formations du parcours" className="m-0 flex list-none flex-col overflow-hidden rounded-carte border border-bordure-carte bg-panneau p-0">
              {ids.map((id, index) => {
                const f = parId.get(id);
                return f ? <Ligne key={id} formation={f} rang={index + 1} onChanger={ouvrirChangement} /> : null;
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <Dialog
        open={aChanger !== null}
        onOpenChange={(o) => !o && setAChanger(null)}
        title={aChanger ? `Changer « ${aChanger.titre} » de parcours` : ""}
        description={`Elle quitte « ${parcours.nom} » et se range à la fin du parcours choisi.`}
        icon={Route01Icon}
        footer={
          <>
            <Button variant="gris" onClick={() => setAChanger(null)}>
              Annuler
            </Button>
            <Button loading={occupe} onClick={() => void changer()}>
              Changer de parcours
            </Button>
          </>
        }
      >
        <RadioGroup label="Parcours d’arrivée" name="parcours-arrivee" options={autres.map((p) => ({ value: p.id, label: p.nom }))} value={cible} onValueChange={setCible} />
        {erreur && (
          <p role="alert" className="m-0 mt-3 text-[13px] leading-5 text-erreur-texte">
            {erreur}
          </p>
        )}
      </Dialog>

      <Dialog
        open={ajout}
        onOpenChange={setAjout}
        title="Ajouter une formation au parcours"
        description={`Elle se range à la fin de « ${parcours.nom} » ; elle reste aussi dans ses autres parcours.`}
        icon={Add01Icon}
        returnFocus={() => boutonAjout.current}
        footer={
          <>
            <Button variant="gris" onClick={() => setAjout(false)}>
              Annuler
            </Button>
            <Button loading={occupe} onClick={() => void ajouter()}>
              Ajouter
            </Button>
          </>
        }
      >
        <Field label="Formation" htmlFor={idAjout}>
          <Select
            id={idAjout}
            value={aAjouter}
            onChange={(e) => setAAjouter(e.target.value)}
            options={[{ value: "", label: "Choisir une formation" }, ...fiche.aAjouter.map((f) => ({ value: f.id, label: f.statut === "publiee" ? f.titre : `${f.titre} (${STATUTS[f.statut].toLowerCase()})` }))]}
          />
        </Field>
        {erreur && (
          <p role="alert" className="m-0 mt-3 text-[13px] leading-5 text-erreur-texte">
            {erreur}
          </p>
        )}
      </Dialog>
    </div>
  );
}
