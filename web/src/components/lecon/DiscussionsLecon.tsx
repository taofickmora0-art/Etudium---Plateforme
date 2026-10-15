"use client";

import { useState } from "react";
import { Comment01Icon } from "@hugeicons/core-free-icons";
import { Reponses, type ActionsReponses, type EtatReponses } from "@/components/communaute/Reponses";
import { Icon } from "@/components/ui/Icon";
import type { MoiCommunaute, Reponse } from "@/lib/communaute/types";
import {
  aimerCommentaireLecon,
  chargerDiscussion,
  commenterLecon,
  modifierCommentaireLecon,
  signalerCommentaireLecon,
  supprimerCommentaireLecon,
} from "@/lib/lecon/discussions";

const pluriel = (n: number, mot: string) => `${n.toLocaleString("fr-FR")} ${mot}${n > 1 ? "s" : ""}`;

/**
 * « Discussions de la leçon » (refonte des formations, spec §1.6, d'après izimentor) : sous le contenu, les commentaires
 * des comptes qui ont accès à la leçon, avec Répondre (un niveau), J’aime, le menu ⋮ et « Voir plus de commentaires » ;
 * le formateur porte son étiquette. Le même écran que les commentaires de la communauté.
 */
export function DiscussionsLecon({
  leconId,
  slug,
  initial,
  moi,
  maintenant,
}: {
  leconId: string;
  slug: string;
  initial: { total: number; reponses: Reponse[] };
  moi: MoiCommunaute;
  maintenant: Date;
}) {
  const [etat, setEtat] = useState<EtatReponses>(() => ({ ...initial, completes: initial.total <= initial.reponses.length }));
  const actions: ActionsReponses = {
    charger: () => chargerDiscussion(leconId),
    repondre: (texte, parentId) => commenterLecon(leconId, texte, parentId),
    modifier: modifierCommentaireLecon,
    aimer: aimerCommentaireLecon,
    supprimer: supprimerCommentaireLecon,
    signaler: signalerCommentaireLecon,
    lien: (id) => `${window.location.origin}/formations/${slug}/lecons/${leconId}#commentaire-${id}`,
  };
  return (
    <section aria-labelledby="discussions-titre" className="flex min-w-0 flex-col rounded-carte bg-bleu-clair/60 px-6 py-5 max-sm:-mx-1 max-sm:px-4 max-sm:py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="discussions-titre" className="m-0 flex items-center gap-2 text-xl leading-7 font-semibold text-encre max-sm:text-lg max-sm:leading-6">
          <Icon icon={Comment01Icon} size={22} className="text-bleu" />
          Discussions de la leçon
        </h2>
        <span className="text-[13px] leading-5 text-discret">{pluriel(etat.total, "commentaire")}</span>
      </div>
      {etat.total === 0 && <p className="m-0 mt-2 text-sm leading-5 text-discret">Aucun commentaire pour l’instant : posez la première question.</p>}
      <Reponses
        actions={actions}
        etat={etat}
        onChange={setEtat}
        moi={moi}
        maintenant={maintenant}
        champ={{ etiquette: "Rédiger un commentaire", indication: "Rédiger un commentaire…", envoyer: "Publier le commentaire" }}
      />
    </section>
  );
}
