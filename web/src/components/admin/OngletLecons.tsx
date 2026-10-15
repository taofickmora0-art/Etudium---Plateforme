"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  closestCorners,
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
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Add01Icon,
  ArrowDown02Icon,
  ArrowUp02Icon,
  CourseIcon,
  Delete02Icon,
  DragDropVerticalIcon,
  FolderTransferIcon,
  MoreVerticalIcon,
  PencilEdit02Icon,
  UnfoldLessIcon,
  UnfoldMoreIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, type MenuEntry } from "@/components/ui/Menu";
import { Select } from "@/components/ui/Select";
import { Heading } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { addLecon, addModule, changerStatutLecon, deleteLecon, deleteModule, ranger, renameModule } from "@/lib/admin/actions";
import { formatDuree } from "@/lib/admin/duree";
import { baseFormations, type EspaceEdition } from "@/lib/admin/espace";
import { cleLecon, cleModule, deplacementApresDepot, deplacerDans, type Deplacement } from "@/lib/admin/rangement";
import type { FormationAdmin, LeconResume, ModuleAdmin } from "@/lib/admin/types";
import { StatutLecon } from "./StatutLecon";
import { useFormulaireAdmin } from "./useFormulaireAdmin";

const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** « 06:10 · Vidéo · Aperçu » : ce qu'il reste à compléter se voit d'un coup d'œil. */
const resumeLecon = (l: LeconResume) => [formatDuree(l.dureeSecondes) || "Durée à saisir", l.aVideo ? "Vidéo" : "Sans vidéo", l.apercu && "Aperçu"].filter(Boolean).join(" · ");

/** « Ses 2 leçons… », « Sa leçon… », « Cette section est vide. » */
const consequenceSuppression = (n: number) =>
  n === 0 ? "Cette section est vide." : n === 1 ? "Sa leçon, sa vidéo et ses documents seront supprimés." : `Ses ${n} leçons, leurs vidéos et leurs documents seront supprimés.`;

/** Une fenêtre à un seul champ (« Titre de la section », « Titre de la leçon ») qui envoie une action du back-office. */
function FenetreTitre({
  open,
  onOpenChange,
  titre,
  label,
  bouton,
  action,
  champs,
  valeurInitiale = "",
  succes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titre: string;
  label: string;
  bouton: string;
  action: Parameters<typeof useFormulaireAdmin>[0];
  champs: Record<string, string>;
  valeurInitiale?: string;
  succes: string;
}) {
  const id = useId();
  const formulaire = `${id}-formulaire`;
  const { state, envoyer, pending, erreurs, valeur } = useFormulaireAdmin(action, { succes });
  // Une fois enregistré, la fenêtre se ferme (une leçon créée ouvre aussi sa page).
  useEffect(() => {
    if (state.status === "success") onOpenChange(false);
  }, [state, onOpenChange]);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={titre}
      footer={
        <>
          <Button variant="contour" disabled={pending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form={formulaire} loading={pending}>
            {bouton}
          </Button>
        </>
      }
    >
      <form id={formulaire} onSubmit={envoyer} noValidate className="flex flex-col gap-3">
        {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}
        {Object.entries(champs).map(([nom, v]) => (
          <input key={nom} type="hidden" name={nom} value={v} />
        ))}
        <Field label={label} htmlFor={`${id}-titre`} error={erreurs.titre}>
          <TextInput id={`${id}-titre`} name="titre" defaultValue={valeur("titre", valeurInitiale)} maxLength={120} autoFocus />
        </Field>
      </form>
    </Dialog>
  );
}

/** La poignée ⠿ d'un élément qu'on glisse : souris, toucher, ou clavier (Espace, flèches, Espace). */
function Poignee({ nom, id }: { nom: string; id: string }) {
  const { attributes, listeners, setActivatorNodeRef } = useSortable({ id });
  return (
    <button
      type="button"
      aria-label={`Déplacer ${nom}`}
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      className="focus-etudium flex size-8 flex-none cursor-grab touch-none items-center justify-center rounded-puce text-discret hover:bg-coque active:cursor-grabbing max-sm:size-7"
    >
      <Icon icon={DragDropVerticalIcon} size={18} />
    </button>
  );
}

type ContexteSection = {
  formation: Pick<FormationAdmin, "id" | "slug">;
  espace: EspaceEdition;
  modules: ModuleAdmin[];
  appliquer: (d: Deplacement) => void;
  changerStatut: (lecon: LeconResume, publiee: boolean) => void;
  deplacerVers: (lecon: LeconResume) => void;
  supprimerLecon: (lecon: LeconResume) => void;
};

function LigneLecon({ lecon, module, rang, total, ctx }: { lecon: LeconResume; module: ModuleAdmin; rang: number; total: number; ctx: ContexteSection }) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: cleLecon(lecon.id) });
  const lien = `${baseFormations(ctx.espace)}/${ctx.formation.id}/lecons/${lecon.id}`;
  const items: MenuEntry[] = [
    { label: "Modifier", icon: PencilEdit02Icon, href: lien },
    { label: "Voir comme un étudiant", icon: ViewIcon, href: `/formations/${ctx.formation.slug}/lecons/${lecon.id}` },
    { separator: true },
    ...(rang > 1 ? [{ label: "Monter", icon: ArrowUp02Icon, onSelect: () => ctx.appliquer({ type: "lecon", id: lecon.id, module: module.id, position: rang - 1 }) }] : []),
    ...(rang < total ? [{ label: "Descendre", icon: ArrowDown02Icon, onSelect: () => ctx.appliquer({ type: "lecon", id: lecon.id, module: module.id, position: rang + 1 }) }] : []),
    ...(ctx.modules.length > 1 ? [{ label: "Déplacer vers…", icon: FolderTransferIcon, onSelect: () => ctx.deplacerVers(lecon) }] : []),
    { separator: true },
    { label: "Supprimer", icon: Delete02Icon, danger: true, onSelect: () => ctx.supprimerLecon(lecon) },
  ];
  return (
    <li
      ref={setNodeRef}
      aria-label={lecon.titre}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex min-w-0 items-center gap-2 border-t border-bordure-carte bg-panneau py-2.5 pr-2 pl-3 max-sm:gap-1.5 max-sm:pl-1.5", isDragging && "relative z-10 shadow-menu")}
    >
      <Poignee nom={`« ${lecon.titre} »`} id={cleLecon(lecon.id)} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={lien} className="focus-etudium text-[15px] leading-[22px] font-medium wrap-anywhere text-encre no-underline hover:underline max-sm:text-sm max-sm:leading-5">
          {lecon.titre}
        </Link>
        <span className="truncate text-[13px] leading-5 text-discret max-sm:text-xs">{resumeLecon(lecon)}</span>
      </span>
      <StatutLecon publiee={lecon.publiee} onChange={(publiee) => ctx.changerStatut(lecon, publiee)} />
      <Menu
        label={`Actions sur « ${lecon.titre} »`}
        trigger={<IconButton icon={MoreVerticalIcon} label={`Actions sur « ${lecon.titre} »`} variant="discret" size="sm" />}
        items={items}
      />
    </li>
  );
}

function Section({
  module,
  rang,
  replie,
  onReplier,
  ctx,
  onAjouter,
  onRenommer,
  onSupprimer,
}: {
  module: ModuleAdmin;
  rang: number;
  replie: boolean;
  onReplier: () => void;
  ctx: ContexteSection;
  onAjouter: () => void;
  onRenommer: () => void;
  onSupprimer: () => void;
}) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: cleModule(module.id) });
  const listeId = useId();
  const total = ctx.modules.length;
  const items: MenuEntry[] = [
    { label: "Renommer", icon: PencilEdit02Icon, onSelect: onRenommer },
    ...(rang > 1 ? [{ label: "Monter", icon: ArrowUp02Icon, onSelect: () => ctx.appliquer({ type: "module", id: module.id, module: null, position: rang - 1 }) }] : []),
    ...(rang < total ? [{ label: "Descendre", icon: ArrowDown02Icon, onSelect: () => ctx.appliquer({ type: "module", id: module.id, module: null, position: rang + 1 }) }] : []),
    { separator: true },
    { label: "Supprimer", icon: Delete02Icon, danger: true, onSelect: onSupprimer },
  ];
  return (
    <section
      ref={setNodeRef}
      aria-label={`Module ${rang} : ${module.titre}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("min-w-0 border-t border-bordure-carte first:border-t-0", isDragging && "relative z-10 bg-panneau shadow-menu")}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 bg-page/60 py-3 pr-2 pl-1.5 max-sm:py-2.5">
        <Poignee nom={`la section « ${module.titre} »`} id={cleModule(module.id)} />
        <h3 className="m-0 min-w-0 flex-1 text-[15px] leading-[22px] font-semibold wrap-anywhere text-encre max-sm:text-sm max-sm:leading-5">
          Module {rang} : {module.titre}
        </h3>
        <span className="ml-auto flex flex-none items-center gap-1.5">
          <button
            type="button"
            aria-expanded={!replie}
            aria-controls={listeId}
            onClick={onReplier}
            className="focus-etudium inline-flex h-7 items-center gap-1 rounded-puce bg-coque px-2 text-xs leading-[18px] font-medium text-texte hover:bg-coque-survol"
          >
            <Icon icon={replie ? UnfoldMoreIcon : UnfoldLessIcon} size={14} />
            {pluriel(module.lecons.length, "leçon")}
          </button>
          <Button variant="contour" size="sm" iconLeft={Add01Icon} aria-label={`Ajouter une leçon à « ${module.titre} »`} onClick={onAjouter} className="max-sm:px-2">
            Ajouter
          </Button>
          <Menu
            label={`Actions sur « ${module.titre} »`}
            trigger={<IconButton icon={MoreVerticalIcon} label={`Actions sur « ${module.titre} »`} variant="discret" size="sm" />}
            items={items}
          />
        </span>
      </div>
      {!replie && (
        <ul id={listeId} aria-label={`Leçons du module ${rang}`} className="m-0 list-none p-0">
          <SortableContext items={module.lecons.map((l) => cleLecon(l.id))} strategy={verticalListSortingStrategy}>
            {module.lecons.map((l, index) => (
              <LigneLecon key={l.id} lecon={l} module={module} rang={index + 1} total={module.lecons.length} ctx={ctx} />
            ))}
          </SortableContext>
          {module.lecons.length === 0 && <li className="border-t border-bordure-carte px-4 py-3 text-[13px] leading-5 text-discret">Aucune leçon : glissez-en une ici, ou « Ajouter ».</li>}
        </ul>
      )}
    </section>
  );
}

type OngletLeconsProps = {
  formation: Pick<FormationAdmin, "id" | "slug" | "modules">;
  /** Adresse de base des formations : le back-office, ou l'espace formateur. */
  base?: "/admin/formations" | "/formateur/formations";
};

type Fenetre =
  | { type: "section" }
  | { type: "lecon"; module: ModuleAdmin }
  | { type: "renommer"; module: ModuleAdmin }
  | { type: "supprimerSection"; module: ModuleAdmin }
  | { type: "supprimerLecon"; lecon: LeconResume }
  | { type: "deplacer"; lecon: LeconResume };

/**
 * L'onglet « Leçons » d'une formation (refonte des formations, spec §3.2, d'après izimentor) : « n sections · n leçons »,
 * chaque section repliable avec ses leçons, leur statut et leurs actions ; on range au glisser-déposer (souris, toucher,
 * clavier) ou par le menu ⋮ (Monter, Descendre, « Déplacer vers… »). L'écran change aussitôt et revient en arrière si la
 * base refuse.
 */
export function OngletLecons({ formation, base = "/admin/formations" }: OngletLeconsProps) {
  const espace: EspaceEdition = base === "/formateur/formations" ? "formateur" : "admin";
  const { toast } = useToast();
  // Le programme affiché : celui du serveur, changé aussitôt par un rangement ou un statut.
  const [source, setSource] = useState(formation.modules);
  const [programme, setProgramme] = useState(formation.modules);
  if (formation.modules !== source) {
    setSource(formation.modules);
    setProgramme(formation.modules);
  }
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);
  const [cible, setCible] = useState("");
  const [erreurSuppression, setErreurSuppression] = useState<string>();
  const fermer = (open: boolean) => !open && setFenetre(null);

  const nbLecons = programme.reduce((n, m) => n + m.lecons.length, 0);
  const toutReplie = programme.length > 0 && programme.every((m) => replies.has(m.id));

  async function appliquer(d: Deplacement | null) {
    if (!d) return;
    const avant = programme;
    setProgramme(deplacerDans(programme, d));
    const reponse = await ranger(d.type === "module" ? "modules" : "lecons", d.id, d.module, d.position).catch(() => ({ ok: false, message: ECHEC }));
    if (!reponse.ok) {
      setProgramme(avant);
      toast({ tone: "erreur", title: reponse.message ?? ECHEC });
    }
  }

  async function changerStatut(lecon: LeconResume, publiee: boolean) {
    const avant = programme;
    setProgramme(programme.map((m) => ({ ...m, lecons: m.lecons.map((l) => (l.id === lecon.id ? { ...l, publiee } : l)) })));
    const reponse = await changerStatutLecon(lecon.id, publiee).catch(() => ({ ok: false, message: ECHEC }));
    if (!reponse.ok) {
      setProgramme(avant);
      toast({ tone: "erreur", title: reponse.message ?? ECHEC });
    } else {
      toast({ tone: "reussite", title: publiee ? "Leçon publiée" : "Leçon remise en brouillon" });
    }
  }

  const ctx: ContexteSection = {
    formation,
    espace,
    modules: programme,
    appliquer: (d) => void appliquer(d),
    changerStatut: (l, p) => void changerStatut(l, p),
    deplacerVers: (lecon) => {
      setCible(programme.find((m) => m.lecons.every((l) => l.id !== lecon.id))?.id ?? programme[0]?.id ?? "");
      setFenetre({ type: "deplacer", lecon });
    },
    supprimerLecon: (lecon) => {
      setErreurSuppression(undefined);
      setFenetre({ type: "supprimerLecon", lecon });
    },
  };

  // Le glisser-déposer : souris (après 6 px), toucher (appui de 200 ms) ou clavier ; annonces en français.
  const capteurs = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nomDe = (cle: UniqueIdentifier) => {
    const [type, id] = String(cle).split(":");
    if (type === "module") return `la section « ${programme.find((m) => m.id === id)?.titre ?? ""} »`;
    return `« ${programme.flatMap((m) => m.lecons).find((l) => l.id === id)?.titre ?? ""} »`;
  };
  const annonces: Announcements = {
    onDragStart: ({ active }) => `${nomDe(active.id)} saisie.`,
    onDragOver: ({ active, over }) => (over ? `${nomDe(active.id)} au-dessus de ${nomDe(over.id)}.` : `${nomDe(active.id)} hors de la liste.`),
    onDragEnd: ({ active, over }) => (over ? `${nomDe(active.id)} déposée sur ${nomDe(over.id)}.` : `${nomDe(active.id)} reposée à sa place.`),
    onDragCancel: ({ active }) => `Déplacement de ${nomDe(active.id)} annulé.`,
  };
  const deposer = ({ active, over }: DragEndEvent) => {
    if (over) void appliquer(deplacementApresDepot(programme, String(active.id), String(over.id)));
  };

  let fenetreActive: ReactNode = null;
  if (fenetre?.type === "section") {
    fenetreActive = (
      <FenetreTitre open onOpenChange={fermer} titre="Nouvelle section" label="Titre de la section" bouton="Ajouter" action={addModule} champs={{ formation_id: formation.id }} succes="Section ajoutée" />
    );
  } else if (fenetre?.type === "lecon") {
    fenetreActive = (
      <FenetreTitre open onOpenChange={fermer} titre="Nouvelle leçon" label="Titre de la leçon" bouton="Ajouter" action={addLecon} champs={{ module_id: fenetre.module.id, espace }} succes="Leçon créée" />
    );
  } else if (fenetre?.type === "renommer") {
    fenetreActive = (
      <FenetreTitre
        open
        onOpenChange={fermer}
        titre="Renommer la section"
        label="Titre de la section"
        bouton="Renommer"
        action={renameModule}
        champs={{ id: fenetre.module.id }}
        valeurInitiale={fenetre.module.titre}
        succes="Section renommée"
      />
    );
  }

  const deplacee = fenetre?.type === "deplacer" ? fenetre.lecon : null;
  const supprimeeSection = fenetre?.type === "supprimerSection" ? fenetre.module : null;
  const supprimeeLecon = fenetre?.type === "supprimerLecon" ? fenetre.lecon : null;
  const supprimer = (action: () => Promise<{ ok: boolean; message?: string }>, succes: string) => async () => {
    const reponse = await action().catch(() => ({ ok: false, message: ECHEC }));
    if (!reponse.ok) {
      setErreurSuppression(reponse.message ?? ECHEC);
      throw new Error(reponse.message);
    }
    toast({ tone: "reussite", title: succes });
  };

  return (
    <div className="flex max-w-[960px] min-w-0 flex-col gap-4">
      <div className="overflow-hidden rounded-carte border border-bordure-carte bg-panneau">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bordure-carte px-5 py-4 max-sm:px-3.5 max-sm:py-3">
          <Heading level="section" className="max-sm:text-lg">
            {`${pluriel(programme.length, "section")} · ${pluriel(nbLecons, "leçon")}`}
          </Heading>
          <span className="flex flex-wrap items-center gap-2">
            {programme.length > 0 && (
              <Button variant="contour" size="sm" iconLeft={toutReplie ? UnfoldMoreIcon : UnfoldLessIcon} onClick={() => setReplies(toutReplie ? new Set() : new Set(programme.map((m) => m.id)))}>
                {toutReplie ? "Tout déplier" : "Tout replier"}
              </Button>
            )}
            <Button size="sm" iconLeft={Add01Icon} aria-label="Ajouter une section" onClick={() => setFenetre({ type: "section" })}>
              Ajouter une section
            </Button>
          </span>
        </div>
        {programme.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={CourseIcon} title="Aucune section pour le moment" description="Ajoutez une section, puis ses leçons." />
          </div>
        ) : (
          <DndContext
            sensors={capteurs}
            collisionDetection={closestCorners}
            onDragEnd={deposer}
            accessibility={{
              announcements: annonces,
              screenReaderInstructions: {
                draggable: "Pour déplacer cet élément, appuyez sur Espace ou Entrée, choisissez sa place avec les flèches, puis Espace ou Entrée pour le déposer, ou Échap pour annuler.",
              },
            }}
          >
            <SortableContext items={programme.map((m) => cleModule(m.id))} strategy={verticalListSortingStrategy}>
              {programme.map((m, index) => (
                <Section
                  key={m.id}
                  module={m}
                  rang={index + 1}
                  replie={replies.has(m.id)}
                  onReplier={() =>
                    setReplies((actuels) => {
                      const suivants = new Set(actuels);
                      if (suivants.has(m.id)) suivants.delete(m.id);
                      else suivants.add(m.id);
                      return suivants;
                    })
                  }
                  ctx={ctx}
                  onAjouter={() => setFenetre({ type: "lecon", module: m })}
                  onRenommer={() => setFenetre({ type: "renommer", module: m })}
                  onSupprimer={() => {
                    setErreurSuppression(undefined);
                    setFenetre({ type: "supprimerSection", module: m });
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {fenetreActive}
      <Dialog
        open={deplacee !== null}
        onOpenChange={fermer}
        title={`Déplacer « ${deplacee?.titre ?? ""} »`}
        icon={FolderTransferIcon}
        footer={
          <>
            <Button variant="contour" onClick={() => setFenetre(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                const section = programme.find((m) => m.id === cible);
                if (deplacee && section) {
                  const deja = section.lecons.some((l) => l.id === deplacee.id);
                  void appliquer({ type: "lecon", id: deplacee.id, module: section.id, position: section.lecons.length + (deja ? 0 : 1) });
                }
                setFenetre(null);
              }}
            >
              Déplacer
            </Button>
          </>
        }
      >
        <Field label="Section" htmlFor="deplacer-section">
          <Select id="deplacer-section" aria-label="Section" value={cible} onChange={(e) => setCible(e.target.value)} options={programme.map((m, i) => ({ value: m.id, label: `Module ${i + 1} : ${m.titre}` }))} />
        </Field>
        <p className="m-0 mt-2 text-[13px] leading-5 text-discret">La leçon va à la fin de cette section.</p>
      </Dialog>
      <ConfirmDialog
        open={supprimeeSection !== null}
        onOpenChange={fermer}
        tone="danger"
        icon={Delete02Icon}
        iconTone="danger"
        title="Supprimer cette section ?"
        description={consequenceSuppression(supprimeeSection?.lecons.length ?? 0)}
        confirmLabel="Supprimer"
        errorMessage={erreurSuppression}
        onConfirm={supprimer(() => (supprimeeSection ? deleteModule(supprimeeSection.id) : Promise.resolve({ ok: true })), "Section supprimée")}
      />
      <ConfirmDialog
        open={supprimeeLecon !== null}
        onOpenChange={fermer}
        tone="danger"
        icon={Delete02Icon}
        iconTone="danger"
        title="Supprimer cette leçon ?"
        description={`« ${supprimeeLecon?.titre ?? ""} » : sa vidéo, son texte et ses documents seront supprimés.`}
        confirmLabel="Supprimer"
        errorMessage={erreurSuppression}
        onConfirm={supprimer(() => (supprimeeLecon ? deleteLecon(supprimeeLecon.id) : Promise.resolve({ ok: true })), "Leçon supprimée")}
      />
    </div>
  );
}
