"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Heading } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { reglerFormule } from "@/lib/admin/paiements/actions";
import { dureeAbonnement } from "@/lib/abonnement/regles";
import type { Formule } from "@/lib/abonnement/types";

/** Une formule : son prix (vide tant qu'il n'est pas fixé), recommandée ou non, proposée ou non. La durée est fixe. */
function LigneFormule({ formule, ecriture }: { formule: Formule; ecriture: boolean }) {
  const router = useRouter();
  const [prix, setPrix] = useState(formule.prix === null ? "" : String(formule.prix));
  const [recommandee, setRecommandee] = useState(formule.recommandee);
  const [active, setActive] = useState(formule.active);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function enregistrer() {
    setOccupe(true);
    const r = await reglerFormule({ formuleId: formule.id, prix, recommandee, active });
    setOccupe(false);
    setMessage(r.ok ? { ok: true, texte: "Enregistré." } : { ok: false, texte: r.message });
    if (r.ok) router.refresh();
  }

  return (
    <section aria-label={`Abonnement ${formule.nom}`} className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-carte border border-bordure-carte px-[19px] py-[18px] max-sm:p-4">
      <div className="min-w-[140px] flex-[0_1_180px]">
        <Heading level="card" as="h3">
          {formule.nom}
        </Heading>
        <p className="m-0 text-sm leading-[22px] text-discret">{dureeAbonnement(formule.dureeMois)}</p>
      </div>
      <Field label="Prix (FCFA)" htmlFor={`prix-${formule.code}`} className="min-w-[160px] flex-[1_1_180px]">
        <TextInput
          id={`prix-${formule.code}`}
          inputMode="numeric"
          placeholder="Non fixé"
          value={prix}
          disabled={!ecriture}
          onChange={(e) => setPrix(e.target.value)}
        />
      </Field>
      <div className="flex flex-[1_1_220px] flex-col gap-2">
        <Switch label="Proposé" checked={active} disabled={!ecriture} onCheckedChange={setActive} />
        <Checkbox label="Recommandé" checked={recommandee} disabled={!ecriture} onChange={(e) => setRecommandee(e.target.checked)} />
      </div>
      {ecriture && (
        <div className="flex flex-col items-end gap-1">
          <Button variant="contour" loading={occupe} onClick={() => void enregistrer()}>
            Enregistrer
          </Button>
          {message && (
            <p role={message.ok ? "status" : "alert"} className={`m-0 text-[13px] leading-5 ${message.ok ? "text-reussite-texte" : "text-erreur-texte"}`}>
              {message.texte}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** L'onglet « Abonnements » : les trois formules. Le prix affiché sur la page d'accueil vient d'ici. */
export function OngletFormules({ formules, ecriture }: { formules: Formule[]; ecriture: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm leading-[22px] text-discret">
        Un prix vide affiche « Prix annoncés au lancement ». Une seule formule est recommandée ; une formule non proposée disparaît de la page d’accueil.
      </p>
      {formules.map((f) => (
        <LigneFormule key={`${f.id}-${f.prix}-${f.recommandee}-${f.active}`} formule={f} ecriture={ecriture} />
      ))}
    </div>
  );
}
