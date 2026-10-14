"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import {
  Bookmark02Icon,
  Comment01Icon,
  Delete02Icon,
  Download04Icon,
  FavouriteIcon,
  Flag02Icon,
  Link01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  Pdf01Icon,
} from "@hugeicons/core-free-icons";
import { Avatar, AvatarGroup } from "@/components/ui/Avatar";
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
import { aimer, basculerEnregistrement, modifierPublication, supprimerPublication } from "@/lib/communaute/actions";
import { moment, refusPublication, tailleLisible, TEXTE_MAX, TITRE_MAX } from "@/lib/communaute/regles";
import type { MoiCommunaute, PieceJointe, Publication, Reponse } from "@/lib/communaute/types";
import { ApercuLien } from "./ApercuLien";
import { FenetreSignalement } from "./FenetreSignalement";
import { initiales, lienPublication, tonAvatar } from "./outils";
import { Reponses, type EtatReponses } from "./Reponses";
import { TexteAvecLiens } from "./TexteAvecLiens";
import { VideoYoutube } from "./VideoYoutube";

const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const pluriel = (n: number, mot: string) => `${n.toLocaleString("fr-FR")} ${mot}${n > 1 ? "s" : ""}`;
// Les boutons J’aime et Commenter du pied de carte (40 × 36 dans le design) ; pressé, l'icône se remplit.
const BOUTON_PIED = "h-9 w-10 rounded-puce max-sm:w-9";
const REMPLI = "text-bleu [&_path]:fill-current";

function Etiquette({ publication }: { publication: Publication }) {
  if (publication.estMoi) return <Tag tone="enAttente">Vous</Tag>;
  if (publication.auteur.role === "formateur") return <Tag tone="complementaire">Formateur</Tag>;
  if (publication.auteur.role === "equipe") return <Tag tone="nouveau">Équipe Étudium</Tag>;
  return null;
}

/** Une publication pas encore en ligne (migration 0020) : en attente de l'équipe, ou bloquée (vue de l'équipe seule). */
function EtiquetteStatut({ publication }: { publication: Publication }) {
  if (publication.statut === "en_attente") return <Tag tone="aCorriger">En attente de vérification</Tag>;
  if (publication.statut === "bloquee") return <Tag tone="echoue">Bloquée</Tag>;
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

/** Mes initiales en tête des derniers qui aiment, ou retirées. */
function avecMoi(aimeePar: string[], miennes: string, jAime: boolean): string[] {
  if (jAime) return [miennes, ...aimeePar.filter((i) => i !== miennes)].slice(0, 3);
  const position = aimeePar.indexOf(miennes);
  return position < 0 ? aimeePar : aimeePar.filter((_, i) => i !== position);
}

/**
 * Une publication (design NdCommunaute ; spec du fil « Actualités », §3 et §4) : l'auteur, son moment et son espace, le
 * signet et le menu ⋮ (copier le lien ; modifier pour l'auteur ; signaler ; supprimer pour l'auteur et l'équipe), le texte
 * et ses liens, le fichier joint, l'aperçu du premier lien, J’aime et Commenter, les initiales des derniers qui aiment, et
 * les commentaires. Sur la page d'une publication (`toutesReponses`), tous les commentaires sont déjà là.
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
  // Sur sa propre page (tous les commentaires), la publication supprimée n'est pas relue : on revient à la Communauté.
  const relire = !toutesReponses;
  const { toast } = useToast();
  const idChamp = useId();
  const [p, setP] = useState(publication);
  const [reponses, setReponses] = useState<EtatReponses>(() =>
    toutesReponses
      ? { reponses: toutesReponses, total: Math.max(publication.reponses, toutesReponses.length), completes: true }
      : { reponses: publication.dernieresReponses, total: publication.reponses, completes: publication.reponses <= publication.dernieresReponses.length },
  );
  const [edition, setEdition] = useState<{ titre: string; texte: string } | null>(null);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);
  const [aimerEnCours, setAimerEnCours] = useState(false);
  const [signetEnCours, setSignetEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [suppression, setSuppression] = useState(false);
  const [signalement, setSignalement] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string>();
  // Modifier et Supprimer ouvrent un champ ou une fenêtre : le menu ne reprend pas le focus en se fermant.
  const fenetreDemandee = useRef(false);

  const nom = `${p.auteur.prenom} ${p.auteur.nom}`.trim() || "Membre d’Étudium";
  const enLigne = p.statut === "publiee";
  const meta = `${moment(p.creeLe, maintenant)} · Publié dans ${p.espace.id ? p.espace.nom : "Général"}${p.modifiee ? " · modifiée" : ""}`;
  const compte = [p.reactions > 0 ? `${p.reactions.toLocaleString("fr-FR")} J’aime` : null, reponses.total > 0 ? pluriel(reponses.total, "commentaire") : null]
    .filter(Boolean)
    .join(" · ");

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
    ...(p.peutSignaler
      ? [
          {
            label: "Signaler",
            icon: Flag02Icon,
            onSelect: () => {
              fenetreDemandee.current = true;
              setSignalement(true);
            },
          },
        ]
      : []),
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
    setSauvegarde(true);
    const reponse = await modifierPublication(p.id, edition.titre.trim(), edition.texte.trim()).catch(() => ({ ok: false as const, message: ECHEC }));
    setSauvegarde(false);
    if (!reponse.ok) {
      setErreurEdition(reponse.message);
      return;
    }
    setP((actuelle) => ({ ...actuelle, titre: edition.titre.trim(), texte: edition.texte.trim(), modifiee: true, statut: reponse.statut, apercu: reponse.apercu }));
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
    setP((actuelle) => ({ ...actuelle, jAime: reponse.jAime, reactions: reponse.reactions, aimeePar: avecMoi(actuelle.aimeePar, moi.initiales, reponse.jAime) }));
  }

  async function basculerSignet() {
    setSignetEnCours(true);
    const reponse = await basculerEnregistrement(p.id).catch(() => ({ ok: false as const, message: ECHEC }));
    setSignetEnCours(false);
    if (!reponse.ok) {
      setErreur(reponse.message);
      return;
    }
    setErreur(null);
    setP((actuelle) => ({ ...actuelle, enregistree: reponse.enregistree }));
    toast(
      reponse.enregistree
        ? { tone: "reussite", title: "Publication enregistrée", description: "Retrouvez-la dans « Mes enregistrements »." }
        : { tone: "information", title: "Publication retirée des enregistrements" },
    );
  }

  async function supprimer() {
    const reponse = await supprimerPublication(p.id, { relire }).catch(() => ({ ok: false as const, message: ECHEC }));
    if (!reponse.ok) {
      setErreurSuppression(reponse.message);
      throw new Error(reponse.message);
    }
    toast({ tone: "reussite", title: "Publication supprimée" });
    onSupprimee(p.id);
  }

  return (
    <article aria-label={`Publication de ${nom}`} className="box-border flex min-w-0 flex-col rounded-2xl border border-bordure-carte bg-panneau px-5 pt-[18px] pb-3.5 max-sm:px-4">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar initials={initiales(p.auteur.prenom, p.auteur.nom)} size={44} tone={tonAvatar(nom)} src={p.estMoi ? moi.photoUrl : null} className="max-sm:size-10 max-sm:text-sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-[15px] leading-[22px] font-semibold wrap-anywhere text-encre max-sm:text-sm max-sm:leading-5">{nom}</span>
            <Etiquette publication={p} />
            <EtiquetteStatut publication={p} />
          </div>
          <span className="text-[13px] leading-5 text-discret max-sm:text-xs max-sm:leading-[18px]">{meta}</span>
        </div>
        <div className="-mt-1 -mr-1.5 flex">
          {enLigne && (
            <IconButton
              icon={Bookmark02Icon}
              label={p.enregistree ? `Retirer la publication de ${nom} des enregistrements` : `Enregistrer la publication de ${nom}`}
              aria-pressed={p.enregistree}
              variant="discret"
              size="sm"
              className={cn(p.enregistree && REMPLI)}
              disabled={signetEnCours}
              onClick={() => void basculerSignet()}
            />
          )}
          <Menu
            label="Actions sur la publication"
            trigger={<IconButton icon={MoreHorizontalIcon} label={`Actions sur la publication de ${nom}`} variant="discret" size="sm" />}
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
            <Button variant="contour" size="sm" onClick={() => setEdition(null)} disabled={sauvegarde}>
              Annuler
            </Button>
            <Button type="submit" size="sm" loading={sauvegarde}>
              Enregistrer
            </Button>
          </div>
        </form>
      ) : (
        <>
          {p.titre && <h3 className="m-0 mt-3.5 text-[17px] leading-[25px] font-semibold wrap-anywhere text-encre max-sm:mt-3 max-sm:text-base max-sm:leading-6">{p.titre}</h3>}
          <TexteAvecLiens
            texte={p.texte}
            className={cn("text-[15px] leading-6 text-texte max-sm:text-sm max-sm:leading-[22px]", p.titre ? "mt-1.5" : "mt-3.5 max-sm:mt-3")}
          />
        </>
      )}
      {p.pieceJointe && <Piece piece={p.pieceJointe} />}
      {p.apercu?.type === "youtube" && <VideoYoutube id={p.apercu.id} className="mt-3.5 rounded-[14px]" />}
      {p.apercu?.type === "lien" && <ApercuLien apercu={p.apercu} />}

      {/* Pas encore en ligne : ni J’aime ni commentaires. */}
      {enLigne && (
        <div className="-mx-2 mt-3 flex min-w-0 items-center gap-1 border-t border-bordure-carte pt-2">
          <IconButton
            icon={FavouriteIcon}
            label={p.jAime ? "Retirer la mention J’aime" : "J’aime"}
            aria-pressed={p.jAime}
            variant="discret"
            className={cn(BOUTON_PIED, p.jAime && REMPLI)}
            disabled={aimerEnCours}
            onClick={() => void basculerJaime()}
          />
          <IconButton icon={Comment01Icon} label="Commenter" variant="discret" className={BOUTON_PIED} onClick={() => document.getElementById(idChamp)?.focus()} />
          <span className="flex-1" />
          {/* Sous 360 px, les initiales laissent la place au compte. */}
          {p.aimeePar.length > 0 && (
            <span aria-hidden className="max-[359px]:hidden">
              <AvatarGroup>
                {p.aimeePar.map((i, n) => (
                  <Avatar key={`${i}-${n}`} initials={i} size={22} tone={tonAvatar(i)} />
                ))}
              </AvatarGroup>
            </span>
          )}
          {compte && <span className="min-w-0 truncate pr-2 pl-1 text-[13px] leading-5 text-discret max-sm:text-xs">{compte}</span>}
        </div>
      )}
      {erreur && (
        <p role="alert" className="m-0 mt-2 text-sm leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
      {enLigne && <Reponses publicationId={p.id} etat={reponses} onChange={setReponses} moi={moi} maintenant={maintenant} idChamp={idChamp} />}

      <ConfirmDialog
        open={suppression}
        onOpenChange={setSuppression}
        tone="danger"
        icon={Delete02Icon}
        title="Supprimer cette publication ?"
        description={`Elle disparaîtra de l’espace ${p.espace.nom} avec tous ses commentaires. Cette action est définitive.`}
        confirmLabel="Supprimer"
        errorMessage={erreurSuppression}
        onConfirm={supprimer}
      />
      {p.peutSignaler && <FenetreSignalement cible={{ publicationId: p.id }} open={signalement} onOpenChange={setSignalement} />}
    </article>
  );
}
