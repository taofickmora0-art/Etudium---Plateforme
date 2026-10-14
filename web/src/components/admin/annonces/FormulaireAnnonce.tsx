"use client";

import { useId, useState } from "react";
import { Megaphone01Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { TextInput } from "@/components/ui/TextInput";
import { publierAnnonce } from "@/lib/notifications/actions";
import { ANNONCE_TEXTE_MAX, ANNONCE_TITRE_MAX, lienDuSite, REFUS_ANNONCE } from "@/lib/notifications/regles";

/** Ce qui manque avant de demander confirmation ; la base revérifie tout (publier_annonce). */
function refus(titre: string, texte: string, lien: string): string | null {
  if (!titre.trim() || titre.trim().length > ANNONCE_TITRE_MAX) return REFUS_ANNONCE.titre;
  if (!texte.trim() || texte.trim().length > ANNONCE_TEXTE_MAX) return REFUS_ANNONCE.texte;
  if (lien.trim() && !lienDuSite(lien.trim())) return REFUS_ANNONCE.lien;
  return null;
}

/**
 * Une annonce à tous les comptes (spec des notifications, §3) : titre, texte et lien facultatif vers une page du site.
 * Elle ne se retire pas : une confirmation la précède.
 */
export function FormulaireAnnonce() {
  const ids = { titre: useId(), texte: useId(), lien: useId() };
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [lien, setLien] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoyee, setEnvoyee] = useState<number | null>(null);

  async function envoyer() {
    const reponse = await publierAnnonce(titre, texte, lien);
    if (!reponse.ok) {
      setErreur(reponse.message);
      return;
    }
    setEnvoyee(reponse.destinataires);
    setTitre("");
    setTexte("");
    setLien("");
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setEnvoyee(null);
        const manque = refus(titre, texte, lien);
        setErreur(manque);
        if (!manque) setConfirmation(true);
      }}
    >
      {erreur && <Banner tone="erreur" title={erreur} />}
      {envoyee !== null && <Banner tone="reussite" title={`Annonce envoyée à ${envoyee} compte${envoyee > 1 ? "s" : ""}.`} />}
      <Field label="Titre" htmlFor={ids.titre}>
        <TextInput id={ids.titre} value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={ANNONCE_TITRE_MAX} />
      </Field>
      <Field label="Texte" htmlFor={ids.texte}>
        <Textarea id={ids.texte} value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={ANNONCE_TEXTE_MAX} rows={4} />
      </Field>
      <Field label="Lien (facultatif)" htmlFor={ids.lien} hint="Une adresse du site, par exemple /formations">
        <TextInput id={ids.lien} value={lien} onChange={(e) => setLien(e.target.value)} maxLength={300} placeholder="/formations" />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" iconLeft={Megaphone01Icon}>
          Envoyer l’annonce
        </Button>
      </div>
      <ConfirmDialog
        open={confirmation}
        onOpenChange={setConfirmation}
        title="Envoyer cette annonce à tous les comptes ?"
        description="Elle apparaîtra dans leurs notifications et ne pourra pas être retirée."
        confirmLabel="Envoyer l’annonce"
        icon={Megaphone01Icon}
        onConfirm={envoyer}
      />
    </form>
  );
}
