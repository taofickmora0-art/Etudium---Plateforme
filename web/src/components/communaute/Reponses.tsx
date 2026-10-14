"use client";

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Delete02Icon, Flag02Icon, FavouriteIcon, Link01Icon, MoreHorizontalIcon, PencilEdit02Icon, SentIcon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, type MenuEntry } from "@/components/ui/Menu";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { aimerReponse, chargerReponses, modifierReponse, repondre, supprimerReponse } from "@/lib/communaute/actions";
import { cn } from "@/lib/cn";
import { moment, refusReponse, REPONSE_MAX } from "@/lib/communaute/regles";
import type { MoiCommunaute, Reponse } from "@/lib/communaute/types";
import { FenetreSignalement } from "./FenetreSignalement";
import { initiales, lienPublication, tonAvatar } from "./outils";
import { TexteAvecLiens } from "./TexteAvecLiens";

export type EtatReponses = { reponses: Reponse[]; total: number; completes: boolean };

const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const ACTION = "focus-etudium inline-flex items-center gap-1 rounded-sm p-0 text-xs leading-[18px] font-medium text-discret transition-colors hover:text-encre disabled:opacity-50";
const CHAMP = "h-[42px] min-w-0 flex-1 rounded-full border-page bg-page text-sm max-sm:h-10 max-sm:text-[13px]";

/** « Koffi D. » → « KD ». */
function initialesReponse(nomCourt: string) {
  const [prenom = "", nom = ""] = nomCourt.split(" ");
  return initiales(prenom, nom);
}

/**
 * Les commentaires d'une publication (design NdCommunaute ; communauté v3, §2) : les commentaires et, décalées dessous,
 * leurs réponses (un seul niveau). Sous chacun : J’aime, Répondre et le menu ⋮ (copier le lien, signaler, modifier,
 * supprimer) ; « Voir plus de commentaires » ; le champ « Écrire un commentaire… ». L'état vit dans la carte, qui affiche
 * le nombre. (La base les appelle encore « réponses ».)
 */
export function Reponses({
  publicationId,
  etat,
  onChange,
  moi,
  maintenant,
  idChamp,
}: {
  publicationId: string;
  etat: EtatReponses;
  /** Toujours une mise à jour fonctionnelle : plusieurs envois et suppressions peuvent se croiser. */
  onChange: Dispatch<SetStateAction<EtatReponses>>;
  moi: MoiCommunaute;
  maintenant: Date;
  /** L'identifiant du champ, que le bouton « Commenter » de la carte rejoint. */
  idChamp?: string;
}) {
  const { toast } = useToast();
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Les commentaires en cours d'envoi d'une action : leurs boutons sont désactivés (pas de double envoi).
  const [occupes, setOccupes] = useState<string[]>([]);
  // Le commentaire que l'on signale (une seule fenêtre pour tous).
  const [aSignaler, setASignaler] = useState<string | null>(null);
  // La réponse en cours : le commentaire de premier niveau visé, l'auteur à qui l'on répond, le texte.
  const [reponse, setReponse] = useState<{ parentId: string; nom: string; texte: string } | null>(null);
  const [envoiReponse, setEnvoiReponse] = useState(false);
  // Le commentaire en cours de modification.
  const [edition, setEdition] = useState<{ id: string; texte: string } | null>(null);
  const [sauvegarde, setSauvegarde] = useState(false);

  const occuper = (id: string, oui: boolean) => setOccupes((ids) => (oui ? [...ids, id] : ids.filter((x) => x !== id)));
  const remplacer = (id: string, modif: Partial<Reponse>) => onChange((actuel) => ({ ...actuel, reponses: actuel.reponses.map((x) => (x.id === id ? { ...x, ...modif } : x)) }));

  // Un commentaire dont le parent n'est pas chargé s'affiche comme un commentaire.
  const ids = new Set(etat.reponses.map((r) => r.id));
  const premiers = etat.reponses.filter((r) => !r.parentId || !ids.has(r.parentId));
  const reponsesDe = (id: string) => etat.reponses.filter((r) => r.parentId === id);

  async function toutVoir() {
    setChargement(true);
    const lu = await chargerReponses(publicationId).catch(() => ({ ok: false as const, message: ECHEC }));
    setChargement(false);
    if (!lu.ok) {
      setErreur(lu.message);
      return;
    }
    setErreur(null);
    // Un commentaire envoyé entre-temps, absent de la liste lue, est gardé.
    onChange((actuel) => {
      const lues = new Set(lu.reponses.map((r) => r.id));
      const reponses = [...lu.reponses, ...actuel.reponses.filter((r) => r.estMoi && !lues.has(r.id))];
      return { reponses, total: Math.max(actuel.total, reponses.length), completes: true };
    });
  }

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    const refus = refusReponse(texte);
    if (refus) {
      setErreur(refus);
      return;
    }
    setEnvoi(true);
    const envoye = await repondre(publicationId, texte.trim()).catch(() => ({ ok: false as const, message: ECHEC }));
    setEnvoi(false);
    if (!envoye.ok) {
      setErreur(envoye.message);
      return;
    }
    setErreur(null);
    setTexte("");
    onChange((actuel) => ({ ...actuel, reponses: [...actuel.reponses, envoye.reponse], total: actuel.total + 1 }));
  }

  async function envoyerReponse(e: FormEvent) {
    e.preventDefault();
    if (!reponse) return;
    const refus = refusReponse(reponse.texte);
    if (refus) {
      setErreur(refus);
      return;
    }
    setEnvoiReponse(true);
    const envoye = await repondre(publicationId, reponse.texte.trim(), reponse.parentId).catch(() => ({ ok: false as const, message: ECHEC }));
    setEnvoiReponse(false);
    if (!envoye.ok) {
      setErreur(envoye.message);
      return;
    }
    setErreur(null);
    setReponse(null);
    onChange((actuel) => ({ ...actuel, reponses: [...actuel.reponses, envoye.reponse], total: actuel.total + 1 }));
  }

  async function aimer(r: Reponse) {
    occuper(r.id, true);
    const resultat = await aimerReponse(r.id).catch(() => ({ ok: false as const, message: ECHEC }));
    occuper(r.id, false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    setErreur(null);
    remplacer(r.id, { jAime: resultat.jAime, reactions: resultat.reactions });
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    if (!edition) return;
    const refus = refusReponse(edition.texte);
    if (refus) {
      setErreur(refus);
      return;
    }
    setSauvegarde(true);
    const resultat = await modifierReponse(edition.id, edition.texte.trim()).catch(() => ({ ok: false as const, message: ECHEC }));
    setSauvegarde(false);
    if (!resultat.ok) {
      setErreur(resultat.message ?? ECHEC);
      return;
    }
    setErreur(null);
    remplacer(edition.id, { texte: edition.texte.trim(), modifie: true });
    setEdition(null);
  }

  async function supprimer(r: Reponse) {
    if (occupes.includes(r.id)) return;
    occuper(r.id, true);
    const resultat = await supprimerReponse(r.id).catch(() => ({ ok: false as const, message: ECHEC }));
    occuper(r.id, false);
    if (!resultat.ok) {
      setErreur(resultat.message ?? ECHEC);
      return;
    }
    setErreur(null);
    // Ses réponses disparaissent avec lui.
    onChange((actuel) => {
      const partis = actuel.reponses.filter((x) => x.id === r.id || x.parentId === r.id);
      if (partis.length === 0) return actuel;
      return { ...actuel, reponses: actuel.reponses.filter((x) => !partis.includes(x)), total: Math.max(0, actuel.total - partis.length) };
    });
    toast({ tone: "reussite", title: "Commentaire supprimé" });
  }

  async function copier(r: Reponse) {
    try {
      await navigator.clipboard.writeText(`${lienPublication(publicationId)}#commentaire-${r.id}`);
      toast({ tone: "reussite", title: "Lien copié" });
    } catch {
      toast({ tone: "erreur", title: "Le lien n’a pas pu être copié." });
    }
  }

  function repondreA(r: Reponse) {
    // Répondre à une réponse répond au même commentaire, en citant son auteur.
    const parentId = r.parentId && ids.has(r.parentId) ? r.parentId : r.id;
    setReponse({ parentId, nom: r.auteur.nomCourt, texte: r.parentId ? `@${r.auteur.nomCourt} ` : "" });
  }

  function Commentaire({ r }: { r: Reponse }) {
    const nom = r.auteur.nomCourt;
    const items: MenuEntry[] = [
      { label: "Copier le lien", icon: Link01Icon, onSelect: () => void copier(r) },
      ...(r.peutSignaler ? [{ label: "Signaler", icon: Flag02Icon, onSelect: () => setASignaler(r.id) }] : []),
      ...(r.peutModifier ? [{ label: "Modifier", icon: PencilEdit02Icon, onSelect: () => setEdition({ id: r.id, texte: r.texte }) }] : []),
      ...(r.peutSupprimer ? [{ label: "Supprimer", icon: Delete02Icon, danger: true, onSelect: () => void supprimer(r) }] : []),
    ];
    const occupe = occupes.includes(r.id);
    return (
      <div className="flex min-w-0 items-start gap-2.5">
        <Avatar initials={initialesReponse(nom)} size={32} tone={tonAvatar(nom)} src={r.estMoi ? moi.photoUrl : null} className="max-sm:size-7 max-sm:text-[11px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {edition?.id === r.id ? (
            <form className="flex min-w-0 flex-col gap-2" onSubmit={(e) => void enregistrer(e)}>
              <TextInput
                aria-label="Modifier le commentaire"
                value={edition.texte}
                maxLength={REPONSE_MAX}
                autoFocus
                onChange={(e) => setEdition({ id: r.id, texte: e.target.value })}
                className={CHAMP}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="discret" size="sm" onClick={() => setEdition(null)}>
                  Annuler
                </Button>
                <Button type="submit" size="sm" loading={sauvegarde}>
                  Enregistrer
                </Button>
              </div>
            </form>
          ) : (
            <div className="min-w-0 self-start rounded-[14px] bg-page px-3 py-2.5">
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-sm leading-5 font-semibold text-encre max-sm:text-[13px]">{nom}</span>
                <span className="text-xs leading-[18px] text-discret">
                  {moment(r.creeLe, maintenant)}
                  {r.modifie && " · modifié"}
                </span>
              </div>
              <TexteAvecLiens texte={r.texte} className="mt-0.5 text-sm leading-[21px] text-texte max-sm:text-[13px] max-sm:leading-5" />
            </div>
          )}
          <div className="flex items-center gap-3.5 pl-3">
            <button
              type="button"
              aria-pressed={r.jAime}
              aria-label={r.jAime ? `Retirer la mention J’aime du commentaire de ${nom}` : `J’aime le commentaire de ${nom}`}
              className={cn(ACTION, r.jAime && "text-erreur-vif hover:text-erreur-texte")}
              disabled={occupe}
              onClick={() => void aimer(r)}
            >
              <Icon icon={FavouriteIcon} size={14} />
              J’aime
              {r.reactions > 0 && <span className="tabular-nums">· {r.reactions.toLocaleString("fr-FR")}</span>}
            </button>
            <button type="button" aria-label={`Répondre à ${nom}`} className={ACTION} onClick={() => repondreA(r)}>
              Répondre
            </button>
            <Menu
              label={`Actions sur le commentaire de ${nom}`}
              trigger={<IconButton icon={MoreHorizontalIcon} label={`Actions sur le commentaire de ${nom}`} variant="discret" size="sm" className="-my-1.5 size-7" />}
              items={items}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex min-w-0 flex-col gap-3">
      {premiers.map((c) => {
        const enfants = reponsesDe(c.id);
        return (
          <div key={c.id} id={`commentaire-${c.id}`} className="flex min-w-0 scroll-mt-24 flex-col gap-2.5">
            {Commentaire({ r: c })}
            {(enfants.length > 0 || reponse?.parentId === c.id) && (
              <div data-reponses="" className="ml-[42px] flex min-w-0 flex-col gap-2.5 max-sm:ml-[38px]">
                {enfants.map((r) => (
                  <div key={r.id} id={`commentaire-${r.id}`} className="min-w-0 scroll-mt-24">
                    {Commentaire({ r })}
                  </div>
                ))}
                {reponse?.parentId === c.id && (
                  <form className="flex min-w-0 items-center gap-2" onSubmit={(e) => void envoyerReponse(e)}>
                    <TextInput
                      aria-label={`Répondre à ${reponse.nom}`}
                      placeholder={`Répondre à ${reponse.nom}…`}
                      value={reponse.texte}
                      maxLength={REPONSE_MAX}
                      autoFocus
                      onChange={(e) => setReponse({ ...reponse, texte: e.target.value })}
                      className={CHAMP}
                    />
                    <IconButton type="submit" icon={SentIcon} label="Envoyer la réponse" variant="discret" disabled={envoiReponse} aria-busy={envoiReponse || undefined} />
                    <Button type="button" variant="discret" size="sm" onClick={() => setReponse(null)}>
                      Annuler
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>
        );
      })}
      {!etat.completes && etat.total > etat.reponses.length && (
        <button
          type="button"
          className="focus-etudium self-start rounded-sm p-0 text-[13px] leading-5 font-medium text-bleu hover:underline disabled:opacity-60"
          disabled={chargement}
          aria-busy={chargement || undefined}
          onClick={() => void toutVoir()}
        >
          Voir plus de commentaires
        </button>
      )}
      {erreur && (
        <p role="alert" className="m-0 text-sm leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
      <form className="flex min-w-0 items-center gap-2.5" onSubmit={(e) => void envoyer(e)}>
        <Avatar initials={moi.initiales} src={moi.photoUrl} size={32} className="max-sm:size-7 max-sm:text-[11px]" />
        <TextInput
          id={idChamp}
          aria-label="Écrire un commentaire"
          placeholder="Écrire un commentaire…"
          value={texte}
          maxLength={REPONSE_MAX}
          onChange={(e) => setTexte(e.target.value)}
          className={CHAMP}
        />
        <IconButton type="submit" icon={SentIcon} label="Envoyer le commentaire" variant="discret" disabled={envoi} aria-busy={envoi || undefined} />
      </form>
      {aSignaler && <FenetreSignalement key={aSignaler} cible={{ reponseId: aSignaler }} open onOpenChange={(ouvert) => !ouvert && setASignaler(null)} />}
    </div>
  );
}
