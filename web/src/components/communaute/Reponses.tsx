"use client";

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Delete02Icon, SentIcon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { chargerReponses, repondre, supprimerReponse } from "@/lib/communaute/actions";
import { moment, refusReponse, REPONSE_MAX } from "@/lib/communaute/regles";
import type { MoiCommunaute, Reponse } from "@/lib/communaute/types";
import { initiales, tonAvatar } from "./outils";

export type EtatReponses = { reponses: Reponse[]; total: number; completes: boolean };

const ECHEC = "L’opération n’a pas abouti. Réessayez.";

/** « Koffi D. » → « KD ». */
function initialesReponse(nomCourt: string) {
  const [prenom = "", nom = ""] = nomCourt.split(" ");
  return initiales(prenom, nom);
}

/**
 * Les réponses d'une publication (design NdCommunaute ; spec, §3) : les dernières, « Voir les N réponses » pour toutes,
 * Supprimer pour son auteur et l'équipe, et le champ « Répondre… ». L'état vit dans la carte, qui affiche le nombre.
 */
export function Reponses({
  publicationId,
  etat,
  onChange,
  moi,
  maintenant,
}: {
  publicationId: string;
  etat: EtatReponses;
  /** Toujours une mise à jour fonctionnelle : plusieurs envois et suppressions peuvent se croiser. */
  onChange: Dispatch<SetStateAction<EtatReponses>>;
  moi: MoiCommunaute;
  maintenant: Date;
}) {
  const { toast } = useToast();
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Les réponses en cours de suppression : leur corbeille est désactivée (pas de double envoi).
  const [enSuppression, setEnSuppression] = useState<string[]>([]);

  async function toutVoir() {
    setChargement(true);
    const reponse = await chargerReponses(publicationId).catch(() => ({ ok: false as const, message: ECHEC }));
    setChargement(false);
    if (!reponse.ok) {
      setErreur(reponse.message);
      return;
    }
    setErreur(null);
    // Une réponse envoyée entre-temps, absente de la liste lue, est gardée.
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
    toast({ tone: "reussite", title: "Réponse supprimée" });
  }

  return (
    <div className="mt-3 flex min-w-0 flex-col gap-3.5 rounded-[14px] bg-page p-4">
      {!etat.completes && etat.total > etat.reponses.length && (
        <Button variant="discret" size="sm" className="-my-1 -ml-3 self-start" loading={chargement} onClick={() => void toutVoir()}>
          Voir les {etat.total} réponses
        </Button>
      )}
      {etat.reponses.map((r) => (
        <div key={r.id} className="flex min-w-0 items-start gap-2.5">
          <Avatar initials={initialesReponse(r.auteur.nomCourt)} size={32} tone={tonAvatar(r.auteur.nomCourt)} src={r.estMoi ? moi.photoUrl : null} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13px] leading-5">
              <span className="font-semibold text-encre">{r.auteur.nomCourt}</span>
              <span className="text-discret"> · {moment(r.creeLe, maintenant)}</span>
            </span>
            <span className="text-sm leading-[22px] whitespace-pre-line text-texte wrap-anywhere">{r.texte}</span>
          </div>
          {r.peutSupprimer && (
            <IconButton
              icon={Delete02Icon}
              label={`Supprimer la réponse de ${r.auteur.nomCourt}`}
              variant="discret"
              size="sm"
              className="-my-1 -mr-2"
              disabled={enSuppression.includes(r.id)}
              onClick={() => void supprimer(r)}
            />
          )}
        </div>
      ))}
      {erreur && (
        <p role="alert" className="m-0 text-sm leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
      <form className="flex min-w-0 items-center gap-2.5" onSubmit={(e) => void envoyer(e)}>
        <Avatar initials={moi.initiales} src={moi.photoUrl} size={32} />
        <TextInput
          aria-label="Répondre"
          placeholder="Répondre…"
          value={texte}
          maxLength={REPONSE_MAX}
          onChange={(e) => setTexte(e.target.value)}
          className="min-w-0 flex-1"
        />
        <IconButton type="submit" icon={SentIcon} label="Envoyer la réponse" variant="discret" disabled={envoi} aria-busy={envoi || undefined} />
      </form>
    </div>
  );
}
