"use client";

import { useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Heading } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { saveLecon } from "@/lib/admin/actions";
import { formatDuree } from "@/lib/admin/duree";
import type { LeconAdmin } from "@/lib/admin/types";
import { parseVideoUrl, videoLabel, videoLink } from "@/lib/admin/video";
import { CARTE_FORMULAIRE } from "./ParcoursForm";
import { useFormulaireAdmin } from "./useFormulaireAdmin";

const GRILLE = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(220px,calc((100%-16px)/2))),1fr))] gap-4";

/** Ce que l'on sait du lien pendant la frappe : reconnu (fournisseur · identifiant) ou non. */
function aideVideo(lien: string) {
  if (!lien.trim()) return "YouTube ou Vimeo, par exemple https://youtu.be/…";
  const video = parseVideoUrl(lien);
  return video ? `Reconnu : ${videoLabel(video)}` : "Lien non reconnu : collez un lien YouTube ou Vimeo.";
}

/** Page d'une leçon (spec du lot 1, §10) : informations, vidéo, aperçu, « Dans cette leçon » et texte. */
export function LeconForm({ lecon }: { lecon: LeconAdmin }) {
  const { state, envoyer, pending, erreurs: e, valeur } = useFormulaireAdmin(saveLecon);
  const [lien, setLien] = useState(() => valeur("video", lecon.video ? videoLink(lecon.video) : ""));
  const apercu = state.values ? state.values.apercu === "on" : lecon.apercu;

  return (
    <form onSubmit={envoyer} noValidate className={CARTE_FORMULAIRE}>
      {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}
      <input type="hidden" name="id" value={lecon.id} />
      <Field label="Titre" htmlFor="lecon-titre" error={e.titre}>
        <TextInput id="lecon-titre" name="titre" defaultValue={valeur("titre", lecon.titre)} maxLength={120} required />
      </Field>
      <Field label="Titre court" htmlFor="lecon-titre-court" hint="Pour le programme de gauche, si le titre est long." error={e.titre_court}>
        <TextInput id="lecon-titre-court" name="titre_court" defaultValue={valeur("titre_court", lecon.titreCourt)} maxLength={40} />
      </Field>
      <div className={GRILLE}>
        <Field label="Lien de la vidéo" htmlFor="lecon-video" hint={aideVideo(lien)} error={e.video}>
          <TextInput
            id="lecon-video"
            name="video"
            type="url"
            inputMode="url"
            value={lien}
            onChange={(evenement) => setLien(evenement.target.value)}
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
        <Field label="Durée" htmlFor="lecon-duree" hint="Durée de la vidéo, par exemple 12:40 (ou 12.40 sur téléphone)." error={e.duree}>
          <TextInput id="lecon-duree" name="duree" inputMode="decimal" placeholder="12:40" defaultValue={valeur("duree", formatDuree(lecon.dureeSecondes))} />
        </Field>
      </div>
      <Switch name="apercu" label="Leçon d’aperçu" description="Visible sans compte, même si la formation est payante." defaultChecked={apercu} />

      <Heading level="card" as="h2" className="mt-2">
        Dans cette leçon
      </Heading>
      <Field label="Résumé" htmlFor="lecon-resume" error={e.resume}>
        <Textarea id="lecon-resume" name="resume" rows={3} defaultValue={valeur("resume", lecon.resume)} maxLength={1000} />
      </Field>
      <Field label="Points clés" htmlFor="lecon-points" hint="Un point par ligne." error={e.points_cles}>
        <Textarea id="lecon-points" name="points_cles" rows={4} defaultValue={valeur("points_cles", lecon.pointsCles.join("\n"))} />
      </Field>
      <Field label="Texte de la leçon" htmlFor="lecon-texte" hint="Texte simple ; l’éditeur riche arrive au lot 4." error={e.texte}>
        <Textarea id="lecon-texte" name="texte" rows={8} defaultValue={valeur("texte", lecon.texte)} maxLength={20000} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
