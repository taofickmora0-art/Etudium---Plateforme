"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AiMagicIcon, Briefcase01Icon, DragDropVerticalIcon, Mortarboard01Icon } from "@hugeicons/core-free-icons";
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
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { rangerParcours } from "@/lib/admin/actions";
import { compter, part, type ChiffresParcours, type StatistiquesParcours } from "@/lib/admin/parcours-chiffres";
import type { ParcoursAdmin } from "@/lib/admin/types";
import type { CouleurParcours } from "@/lib/contenus/libelles";

// La page Parcours du back-office (demande du 2 novembre 2026, option A) : une carte par parcours, aux couleurs du
// parcours, avec ses chiffres et sa part des apprenants. L'ordre des cartes est celui du catalogue : on les range en les
// faisant glisser (souris, toucher, ou clavier avec la poignée).

const COULEURS: Record<CouleurParcours, { fond: string; texte: string; barre: string; icone: IconSvgElement }> = {
  academique: { fond: "bg-bleu-pale", texte: "text-bleu", barre: "bg-bleu", icone: Mortarboard01Icon },
  digital: { fond: "bg-digital-fond", texte: "text-digital-fonce", barre: "bg-digital-vif", icone: AiMagicIcon },
  business: { fond: "bg-business-fond", texte: "text-business-texte", barre: "bg-business-vif", icone: Briefcase01Icon },
};

function Chiffre({ valeur, mot }: { valeur: number; mot: string }) {
  const [nombre, ...reste] = compter(valeur, mot).split(" ");
  return (
    <span data-testid="chiffre-parcours" className="flex min-w-0 items-baseline gap-1 text-[13px] leading-5 text-discret">
      <span className="text-base leading-6 font-semibold text-encre">{nombre}</span> {reste.join(" ")}
    </span>
  );
}

function CarteParcours({ parcours: p, rang, chiffres, totalApprenants }: { parcours: ParcoursAdmin; rang: number; chiffres: ChiffresParcours | null; totalApprenants: number }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const couleur = COULEURS[p.couleur] ?? COULEURS.academique;
  const pourcentage = chiffres ? part(chiffres.apprenants, totalApprenants) : 0;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`box-border flex min-w-0 flex-col gap-3 rounded-carte border border-bordure-carte bg-panneau p-4 ${isDragging ? "relative z-10 shadow-menu" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span aria-hidden="true" className={`flex size-10 flex-none items-center justify-center rounded-champ ${couleur.fond} ${couleur.texte}`}>
          <Icon icon={couleur.icone} size={20} />
        </span>
        <span className="flex items-center gap-1.5">
          {!p.actif && <Tag tone="enAttente">Désactivé</Tag>}
          <span aria-hidden="true" className="text-xs leading-[18px] text-discret">
            {rang}
          </span>
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Déplacer « ${p.nom} »`}
            className="focus-etudium flex size-8 cursor-grab touch-none items-center justify-center rounded-champ text-discret hover:bg-coque active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <Icon icon={DragDropVerticalIcon} size={18} />
          </button>
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="m-0 text-base leading-6 font-semibold text-encre">
          <Link href={`/admin/parcours/${p.id}`} className="focus-etudium text-inherit no-underline hover:underline">
            {p.nom}
          </Link>
        </h2>
        {p.description && <p className="m-0 line-clamp-2 text-[13px] leading-5 text-discret">{p.description}</p>}
      </div>
      {chiffres && (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <Chiffre valeur={chiffres.formationsPubliees} mot="formation" />
            <Chiffre valeur={chiffres.apprenants} mot="apprenant" />
            <Chiffre valeur={chiffres.certificats} mot="certificat" />
            <Chiffre valeur={chiffres.formationsBrouillons} mot="brouillon" />
          </div>
          <div className="mt-auto flex flex-col gap-1.5">
            <div
              role="progressbar"
              aria-label={`Part des apprenants de ${p.nom}`}
              aria-valuenow={pourcentage}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 overflow-hidden rounded-full bg-inactif"
            >
              <div className={`h-full rounded-full ${couleur.barre}`} style={{ width: `${pourcentage}%` }} />
            </div>
            <span className="text-xs leading-[18px] text-discret">{`${pourcentage} % des apprenants`}</span>
          </div>
        </>
      )}
    </li>
  );
}

export function GrilleParcours({ parcours, stats }: { parcours: ParcoursAdmin[]; stats: StatistiquesParcours | null }) {
  const { toast } = useToast();
  const idGlisser = useId();
  const [ordre, setOrdre] = useState(() => parcours.map((p) => p.id));
  const parId = new Map(parcours.map((p) => [p.id, p]));
  // L'ordre de la page, tant que la base n'a pas renvoyé le sien (nouveau parcours, autre onglet) : on suit la page.
  const ids = ordre.length === parcours.length && ordre.every((id) => parId.has(id)) ? ordre : parcours.map((p) => p.id);

  const capteurs = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nomDe = (id: UniqueIdentifier) => `« ${parId.get(String(id))?.nom ?? ""} »`;
  const annonces: Announcements = {
    onDragStart: ({ active }) => `${nomDe(active.id)} saisi.`,
    onDragOver: ({ active, over }) => (over ? `${nomDe(active.id)} à la place de ${nomDe(over.id)}.` : `${nomDe(active.id)} hors de la grille.`),
    onDragEnd: ({ active, over }) => (over ? `${nomDe(active.id)} déposé à la place de ${nomDe(over.id)}.` : `${nomDe(active.id)} reposé à sa place.`),
    onDragCancel: ({ active }) => `Déplacement de ${nomDe(active.id)} annulé.`,
  };

  async function deposer({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const avant = ids;
    const apres = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setOrdre(apres);
    let resultat: { ok: boolean; message?: string };
    try {
      resultat = await rangerParcours(String(active.id), apres.indexOf(String(active.id)) + 1);
    } catch {
      resultat = { ok: false };
    }
    if (!resultat.ok) {
      setOrdre(avant);
      toast({ tone: "erreur", title: resultat.message ?? "Le déplacement n’a pas abouti." });
    }
  }

  return (
    <DndContext
      id={idGlisser}
      sensors={capteurs}
      collisionDetection={closestCenter}
      onDragEnd={(e) => void deposer(e)}
      accessibility={{
        announcements: annonces,
        screenReaderInstructions: {
          draggable: "Pour déplacer ce parcours, appuyez sur Espace ou Entrée, choisissez sa place avec les flèches, puis Espace ou Entrée pour le déposer, ou Échap pour annuler.",
        },
      }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-5 p-0">
          {ids.map((id, index) => {
            const p = parId.get(id);
            return p ? (
              <CarteParcours key={id} parcours={p} rang={index + 1} chiffres={stats ? (stats.parParcours[id] ?? null) : null} totalApprenants={stats?.totaux.apprenants ?? 0} />
            ) : null;
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
