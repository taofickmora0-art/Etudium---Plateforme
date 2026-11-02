"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { Heading } from "@/components/ui/Text";
import { activerEnvois } from "@/lib/admin/envois/actions";
import { SANS_CLE_ENVOIS, type EtatEnvois } from "@/lib/admin/envois/types";

const NOTE = "m-0 text-sm leading-[22px] text-discret";

const ETIQUETTE: Record<EtatEnvois["etat"], { texte: string; tone: TagTone }> = {
  actifs: { texte: "Actifs", tone: "reussi" },
  a_activer: { texte: "À activer", tone: "aCorriger" },
  sans_cle: { texte: "Sans clé", tone: "enAttente" },
};

/**
 * « Envois (e-mails et notifications push) » (mise en ligne, 0071), sous le réglage des paiements : comme lui,
 * l'activation pose en base l'empreinte du jeton du serveur, tiré de la clé Resend ou VAPID. Tant qu'ils ne sont pas
 * actifs, rien ne part. Ni la clé ni le jeton ne sont montrés : seulement leur état, et celui de chaque canal.
 */
export function ReglageEnvois({ etat, ecriture }: { etat: EtatEnvois; ecriture: boolean }) {
  const router = useRouter();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const etiquette = ETIQUETTE[etat.etat];

  async function activer() {
    setOccupe(true);
    setErreur(null);
    const r = await activerEnvois();
    setOccupe(false);
    if (r.ok) router.refresh();
    else setErreur(r.message);
  }

  return (
    <section aria-labelledby="titre-reglage-envois" className="flex flex-col gap-3 rounded-carte border border-bordure-carte px-[19px] py-[18px] max-sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level="card" as="h2">
              <span id="titre-reglage-envois">Envois (e-mails et notifications push)</span>
            </Heading>
            <Tag tone={etiquette.tone}>{etiquette.texte}</Tag>
          </div>
          {etat.etat === "sans_cle" ? (
            <p className={NOTE}>{SANS_CLE_ENVOIS}</p>
          ) : (
            <>
              <p className={NOTE}>{etat.email ? "E-mails : prêts" : "E-mails : ajoutez RESEND_API_KEY et EMAIL_EXPEDITEUR"}</p>
              <p className={NOTE}>{etat.push ? "Notifications push : prêtes" : "Notifications push : ajoutez les trois clés VAPID"}</p>
            </>
          )}
          {etat.etat === "a_activer" && (
            <p className={NOTE}>Rien ne part tant que les envois ne sont pas activés. À refaire après un changement de clé.</p>
          )}
        </div>
        {ecriture && etat.etat === "a_activer" && (
          <Button onClick={() => void activer()} loading={occupe}>
            Activer les envois
          </Button>
        )}
      </div>
      {erreur && (
        <p role="alert" className="m-0 text-sm leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
    </section>
  );
}
