"use client";

import { useRef, useState, type FormEvent } from "react";
import { Comment01Icon, Delete02Icon, Download04Icon, Link01Icon, MoreHorizontalIcon, PencilEdit02Icon, Pdf01Icon, ThumbsUpIcon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { IconButton, iconButtonVariants } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Menu, type MenuEntry } from "@/components/ui/Menu";
import { Tag } from "@/components/ui/Tag";
import { Textarea } from "@/components/ui/Textarea";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { aimer, modifierPublication, supprimerPublication } from "@/lib/communaute/actions";
import { moment, nomEspace, refusPublication, tailleLisible, TEXTE_MAX, TITRE_MAX } from "@/lib/communaute/regles";
import type { MoiCommunaute, PieceJointe, Publication, Reponse } from "@/lib/communaute/types";
import { initiales, lienPublication, tonAvatar } from "./outils";
import { Reponses, type EtatReponses } from "./Reponses";

const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const pluriel = (n: number, mot: string) => `${n.toLocaleString("fr-FR")} ${mot}${n > 1 ? "s" : ""}`;

function Etiquette({ publication }: { publication: Publication }) {
  if (publication.estMoi) return <Tag tone="verrouillee">Vous</Tag>;
  if (publication.auteur.role === "formateur") return <Tag tone="complementaire">Formateur</Tag>;
  if (publication.auteur.role === "equipe") return <Tag tone="nouveau">Équipe Étudium</Tag>;
  return null;
}

/** L'image s'affiche ; le PDF s'ouvre dans un nouvel onglet. Sans lien temporaire, le nom et la taille seuls. */
function Piece({ piece }: { piece: PieceJointe }) {
  if (piece.type.startsWith("image/") && piece.url) {
    return (
      <a href={piece.url} target="_blank" rel="noopener noreferrer" className="focus-etudium mt-3.5 inline-block max-w-full self-start overflow-hidden rounded-[14px] border border-bordure-carte">
        {/* Un lien temporaire de Supabase : l'optimisation d'images de Next ne s'y applique pas. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={piece.url} alt={piece.nom} className="block h-auto max-h-[420px] max-w-full" />
      </a>
    );
  }
  return (
    <div className="mt-3.5 flex min-w-0 items-center gap-3 rounded-[14px] border border-bordure-carte px-3.5 py-3">
      <IconTile icon={Pdf01Icon} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm leading-5 font-medium text-encre">{piece.nom}</span>
        <span className="text-xs leading-[18px] text-discret">{tailleLisible(piece.taille)}</span>
      </span>
      {piece.url && (
        <a href={piece.url} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir ${piece.nom}`} className={iconButtonVariants({ variant: "discret", size: "sm" })}>
          <Icon icon={Download04Icon} size={16} />
        </a>
      )}
    </div>
  );
}

/**
 * Une publication (design NdCommunaute ; spec, §3) : l'auteur, son espace et son moment, le texte et le fichier joint,
 * J’aime, les réponses, et le menu ⋮ (copier le lien ; modifier pour l'auteur ; supprimer pour l'auteur et l'équipe).
 * Sur la page d'une publication (`toutesReponses`), toutes les réponses sont déjà là.
 */
export function CartePublication({
  publication,
  moi,
  maintenant,
  toutesReponses,
  onSupprimee,
}: {
  publication: Publication;
  moi: MoiCommunaute;
  maintenant: Date;
  toutesReponses?: Reponse[];
  onSupprimee: (id: string) => void;
}) {
  const { toast } = useToast();
  const [p, setP] = useState(publication);
  const [reponses, setReponses] = useState<EtatReponses>(() =>
    toutesReponses
      ? { reponses: toutesReponses, total: Math.max(publication.reponses, toutesReponses.length), completes: true }
      : { reponses: publication.dernieresReponses, total: publication.reponses, completes: publication.reponses <= publication.dernieresReponses.length },
  );
  const [ouvert, setOuvert] = useState(Boolean(toutesReponses) || publication.reponses > 0);
  const [edition, setEdition] = useState<{ titre: string; texte: string } | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);
  const [aimerEnCours, setAimerEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [suppression, setSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string>();
  // Modifier et Supprimer ouvrent un champ ou une fenêtre : le menu ne reprend pas le focus en se fermant.
  const fenetreDemandee = useRef(false);

  const nom = `${p.auteur.prenom} ${p.auteur.nom}`.trim() || "Membre d’Étudium";
  const meta = `${nomEspace(p.espace)} · ${moment(p.creeLe, maintenant)}${p.modifiee ? " · modifiée" : ""}`;
  const libelleReponses = reponses.total > 0 ? pluriel(reponses.total, "réponse") : "aucune réponse";

  async function copier() {
    try {
      await navigator.clipboard.writeText(lienPublication(p.id));
      toast({ tone: "reussite", title: "Lien copié" });
    } catch {
      toast({ tone: "erreur", title: "Le lien n’a pas pu être copié." });
    }
  }

  const items: MenuEntry[] = [
    ...(p.estMoi
      ? [
          {
            label: "Modifier",
            icon: PencilEdit02Icon,
            onSelect: () => {
              fenetreDemandee.current = true;
              setErreurEdition(null);
              setEdition({ titre: p.titre, texte: p.texte });
            },
          },
        ]
      : []),
    { label: "Copier le lien", icon: Link01Icon, onSelect: () => void copier() },
    ...(p.peutSupprimer
      ? [
          {
            label: "Supprimer",
            icon: Delete02Icon,
            danger: true,
            onSelect: () => {
              fenetreDemandee.current = true;
              setErreurSuppression(undefined);
              setSuppression(true);
            },
          },
        ]
      : []),
  ];

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    if (!edition) return;
    const refus = refusPublication(edition.titre, edition.texte);
    if (refus) {
      setErreurEdition(refus);
      return;
    }
    setEnregistrement(true);
    const reponse = await modifierPublication(p.id, edition.titre.trim(), edition.texte.trim()).catch(() => ({ ok: false as const, message: ECHEC }));
    setEnregistrement(false);
    if (!reponse.ok) {
      setErreurEdition(reponse.message);
      return;
    }
    setP((actuelle) => ({ ...actuelle, titre: edition.titre.trim(), texte: edition.texte.trim(), modifiee: true }));
    setEdition(null);
  }

  async function basculerJaime() {
    setAimerEnCours(true);
    const reponse = await aimer(p.id).catch(() => ({ ok: false as const, message: ECHEC }));
    setAimerEnCours(false);
    if (!reponse.ok) {
      setErreur(reponse.message);
      return;
    }
    setErreur(null);
    setP((actuelle) => ({ ...actuelle, jAime: reponse.jAime, reactions: reponse.reactions }));
  }

  async function supprimer() {
    const reponse = await supprimerPublication(p.id).catch(() => ({ ok: false as const, message: ECHEC }));
    if (!reponse.ok) {
      setErreurSuppression(reponse.message);
      throw new Error(reponse.message);
    }
    toast({ tone: "reussite", title: "Publication supprimée" });
    onSupprimee(p.id);
  }

  return (
    <article aria-label={`Publication de ${nom}`} className="box-border flex min-w-0 flex-col rounded-2xl border border-bordure-carte bg-panneau px-[19px] pt-[18px] pb-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar initials={initiales(p.auteur.prenom, p.auteur.nom)} size={44} tone={tonAvatar(nom)} src={p.estMoi ? moi.photoUrl : null} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-[15px] leading-[22px] font-semibold wrap-anywhere text-encre">{nom}</span>
            <Etiquette publication={p} />
          </div>
          <span className="text-[13px] leading-5 text-discret">{meta}</span>
        </div>
        <div className="-mt-1 -mr-1.5 flex">
          <Menu
            label="Actions sur la publication"
            trigger={<IconButton icon={MoreHorizontalIcon} label={`Actions sur la publication de ${nom}`} variant="discret" />}
            items={items}
            rendreLeFocus={() => {
              const rendre = !fenetreDemandee.current;
              fenetreDemandee.current = false;
              return rendre;
            }}
          />
        </div>
      </div>

      {edition ? (
        <form className="mt-3.5 flex flex-col gap-2.5" onSubmit={(e) => void enregistrer(e)}>
          <TextInput
            aria-label="Titre de la publication"
            placeholder="Titre (facultatif)"
            value={edition.titre}
            maxLength={TITRE_MAX}
            onChange={(e) => setEdition({ ...edition, titre: e.target.value })}
          />
          <Textarea
            aria-label="Texte de la publication"
            rows={4}
            value={edition.texte}
            maxLength={TEXTE_MAX}
            autoFocus
            onChange={(e) => setEdition({ ...edition, texte: e.target.value })}
          />
          {erreurEdition && (
            <p role="alert" className="m-0 text-sm leading-5 text-erreur-texte">
              {erreurEdition}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="contour" size="sm" onClick={() => setEdition(null)} disabled={enregistrement}>
              Annuler
            </Button>
            <Button type="submit" size="sm" loading={enregistrement}>
              Enregistrer
            </Button>
          </div>
        </form>
      ) : (
        <>
          {p.titre && <h3 className="m-0 mt-3.5 text-base leading-6 font-semibold wrap-anywhere text-encre">{p.titre}</h3>}
          <p className={cn("m-0 text-sm leading-[22px] whitespace-pre-line text-pretty wrap-anywhere text-texte", p.titre ? "mt-1.5" : "mt-3.5")}>{p.texte}</p>
        </>
      )}
      {p.pieceJointe && <Piece piece={p.pieceJointe} />}

      <div className="mt-3 -ml-2 flex flex-wrap items-center gap-1">
        <Button
          variant="discret"
          size="sm"
          iconLeft={ThumbsUpIcon}
          aria-pressed={p.jAime}
          aria-label={p.jAime ? `Retirer la mention J’aime, ${pluriel(p.reactions, "mention")}` : `J’aime, ${pluriel(p.reactions, "mention")}`}
          className={cn(p.jAime && "font-semibold text-bleu")}
          disabled={aimerEnCours}
          onClick={() => void basculerJaime()}
        >
          {p.reactions.toLocaleString("fr-FR")}
        </Button>
        <Button
          variant="discret"
          size="sm"
          iconLeft={Comment01Icon}
          aria-expanded={ouvert}
          aria-label={`${ouvert ? "Masquer" : "Afficher"} les réponses, ${libelleReponses}`}
          className={cn(ouvert && "bg-coque enabled:hover:bg-coque-survol")}
          onClick={() => setOuvert(!ouvert)}
        >
          {reponses.total > 0 ? libelleReponses : "Répondre"}
        </Button>
      </div>
      {erreur && (
        <p role="alert" className="m-0 mt-2 text-sm leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
      {ouvert && <Reponses publicationId={p.id} etat={reponses} onChange={setReponses} moi={moi} maintenant={maintenant} />}

      <ConfirmDialog
        open={suppression}
        onOpenChange={setSuppression}
        tone="danger"
        icon={Delete02Icon}
        title="Supprimer cette publication ?"
        description={`Elle disparaîtra de l’espace ${p.espace.nom} avec toutes ses réponses. Cette action est définitive.`}
        confirmLabel="Supprimer"
        errorMessage={erreurSuppression}
        onConfirm={supprimer}
      />
    </article>
  );
}
