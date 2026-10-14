"use client";

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { SentIcon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { chargerReponses, repondre, supprimerReponse } from "@/lib/communaute/actions";
import { moment, refusReponse, REPONSE_MAX } from "@/lib/communaute/regles";
import type { MoiCommunaute, Reponse } from "@/lib/communaute/types";
import { FenetreSignalement } from "./FenetreSignalement";
import { initiales, tonAvatar } from "./outils";
import { TexteAvecLiens } from "./TexteAvecLiens";

export type EtatReponses = { reponses: Reponse[]; total: number; completes: boolean };

const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const ACTION = "focus-etudium rounded-sm p-0 text-xs leading-[18px] font-medium text-discret transition-colors hover:text-encre disabled:opacity-50";

/** « Koffi D. » → « KD ». */
function initialesReponse(nomCourt: string) {
  const [prenom = "", nom = ""] = nomCourt.split(" ");
  return initiales(prenom, nom);
}

/**
 * Les commentaires d'une publication (design NdCommunaute ; spec du fil « Actualités », §4) : les derniers en bulles,
 * « Voir les N commentaires » pour tous, Signaler et Supprimer sous la bulle, et le champ « Écrire un commentaire… ».
 * L'état vit dans la carte, qui affiche le nombre. (La base les appelle encore « réponses ».)
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
  // Les commentaires en cours de suppression : leur bouton est désactivé (pas de double envoi).
  const [enSuppression, setEnSuppression] = useState<string[]>([]);
  // Le commentaire que l'on signale (une seule fenêtre pour tous).
  const [aSignaler, setASignaler] = useState<string | null>(null);

  async function toutVoir() {
    setChargement(true);
    const reponse = await chargerReponses(publicationId).catch(() => ({ ok: false as const, message: ECHEC }));
    setChargement(false);
    if (!reponse.ok) {
      setErreur(reponse.message);
      return;
    }
    setErreur(null);
    // Un commentaire envoyé entre-temps, absent de la liste lue, est gardé.
    onChange((actuel) => {
      const lues = new Set(reponse.reponses.map((r) => r.id));
      const reponses = [...reponse.reponses, ...actuel.reponses.filter((r) => r.estMoi && !lues.has(r.id))];
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
    const reponse = await repondre(publicationId, texte.trim()).catch(() => ({ ok: false as const, message: ECHEC }));
    setEnvoi(false);
    if (!reponse.ok) {
      setErreur(reponse.message);
      return;
    }
    setErreur(null);
    setTexte("");
    onChange((actuel) => ({ ...actuel, reponses: [...actuel.reponses, reponse.reponse], total: actuel.total + 1 }));
  }

  async function supprimer(r: Reponse) {
    setEnSuppression((ids) => [...ids, r.id]);
    const reponse = await supprimerReponse(r.id).catch(() => ({ ok: false as const, message: ECHEC }));
    setEnSuppression((ids) => ids.filter((id) => id !== r.id));
    if (!reponse.ok) {
      setErreur(reponse.message);
      return;
    }
    setErreur(null);
    onChange((actuel) =>
      actuel.reponses.some((x) => x.id === r.id)
        ? { ...actuel, reponses: actuel.reponses.filter((x) => x.id !== r.id), total: Math.max(0, actuel.total - 1) }
        : actuel,
    );
    toast({ tone: "reussite", title: "Commentaire supprimé" });
  }

  return (
    <div className="mt-3 flex min-w-0 flex-col gap-3">
      {etat.reponses.map((r) => (
        <div key={r.id} className="flex min-w-0 items-start gap-2.5">
          <Avatar initials={initialesReponse(r.auteur.nomCourt)} size={32} tone={tonAvatar(r.auteur.nomCourt)} src={r.estMoi ? moi.photoUrl : null} className="max-sm:size-7 max-sm:text-[11px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="min-w-0 self-start rounded-[14px] bg-page px-3 py-2.5">
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-sm leading-5 font-semibold text-encre max-sm:text-[13px]">{r.auteur.nomCourt}</span>
                <span className="text-xs leading-[18px] text-discret">{moment(r.creeLe, maintenant)}</span>
              </div>
              <TexteAvecLiens texte={r.texte} className="mt-0.5 text-sm leading-[21px] text-texte max-sm:text-[13px] max-sm:leading-5" />
            </div>
            {(r.peutSignaler || r.peutSupprimer) && (
              <div className="flex items-center gap-3.5 pl-3">
                {r.peutSignaler && (
                  <button type="button" aria-label={`Signaler le commentaire de ${r.auteur.nomCourt}`} className={ACTION} onClick={() => setASignaler(r.id)}>
                    Signaler
                  </button>
                )}
                {r.peutSupprimer && (
                  <button
                    type="button"
                    aria-label={`Supprimer le commentaire de ${r.auteur.nomCourt}`}
                    className={ACTION}
                    disabled={enSuppression.includes(r.id)}
                    onClick={() => void supprimer(r)}
                  >
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
      {!etat.completes && etat.total > etat.reponses.length && (
        <button
          type="button"
          className="focus-etudium self-start rounded-sm p-0 text-[13px] leading-5 font-medium text-bleu hover:underline disabled:opacity-60"
          disabled={chargement}
          aria-busy={chargement || undefined}
          onClick={() => void toutVoir()}
        >
          Voir les {etat.total} commentaires
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
          className="h-[42px] min-w-0 flex-1 rounded-full border-page bg-page text-sm max-sm:h-10 max-sm:text-[13px]"
        />
        <IconButton type="submit" icon={SentIcon} label="Envoyer le commentaire" variant="discret" disabled={envoi} aria-busy={envoi || undefined} />
      </form>
      {aSignaler && <FenetreSignalement key={aSignaler} cible={{ reponseId: aSignaler }} open onOpenChange={(ouvert) => !ouvert && setASignaler(null)} />}
    </div>
  );
}
