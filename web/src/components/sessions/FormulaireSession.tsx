"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { TextInput } from "@/components/ui/TextInput";
import type { EspaceEdition } from "@/lib/admin/espace";
import { creerSession, modifierSession } from "@/lib/sessions/actions";
import { champsDepuis, debutDepuis, DESCRIPTION_MAX, DUREE_PAR_DEFAUT, DUREES, dureeLisible, refusSession, TITRE_MAX } from "@/lib/sessions/regles";
import type { DonneesSession, SessionDetail } from "@/lib/sessions/types";
import { baseSessions } from "./cadre";

type Props = {
  espace: EspaceEdition;
  parcours: { id: string; nomCourt: string }[];
  /** Au back-office seulement : le choix de l'animateur. */
  formateurs?: { id: string; nom: string }[];
  /** En modification : la session telle qu'elle est. */
  initial?: SessionDetail;
};

/**
 * Programmer ou modifier une session live (spec, §2 et §4). Le formateur anime toujours ses sessions ; l'équipe choisit
 * l'animateur. Les limites sont vérifiées ici puis par la base, avec les mêmes messages.
 */
export function FormulaireSession({ espace, parcours, formateurs, initial }: Props) {
  const router = useRouter();
  const id = useId();
  const champs = initial ? champsDepuis(initial.debut) : { date: "", heure: "" };
  const [titre, setTitre] = useState(initial?.titre ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(champs.date);
  const [heure, setHeure] = useState(champs.heure);
  const [duree, setDuree] = useState(String(initial?.dureeMinutes ?? DUREE_PAR_DEFAUT));
  const [lien, setLien] = useState(initial?.lien ?? "");
  const [parcoursId, setParcoursId] = useState(initial?.parcours?.id ?? "");
  const [formateurId, setFormateurId] = useState(initial?.formateurId ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function enregistrer() {
    const d: DonneesSession = {
      titre: titre.trim(),
      description: description.trim(),
      date,
      heure,
      dureeMinutes: Number(duree),
      lien: lien.trim(),
      parcoursId: parcoursId || null,
      formateurId: espace === "admin" ? formateurId || null : null,
    };
    // En modification, le début n'est revérifié que s'il change (corriger le lien d'une session en cours).
    const debut = debutDepuis(date, heure);
    const verifierDebut = !initial || debut === null || Date.parse(debut) !== Date.parse(initial.debut);
    const refus = refusSession(d, new Date(), { verifierDebut });
    if (refus) {
      setErreur(refus);
      return;
    }
    setEnvoi(true);
    const reponse = initial ? await modifierSession(initial.id, d) : await creerSession(d);
    setEnvoi(false);
    if (!reponse.ok) {
      setErreur(reponse.message ?? "L’opération n’a pas abouti. Réessayez.");
      return;
    }
    setErreur(null);
    const cible = initial ? initial.id : "id" in reponse ? reponse.id : "";
    router.push(`${baseSessions(espace)}/${cible}`);
  }

  return (
    <form
      className="flex max-w-[680px] min-w-0 flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void enregistrer();
      }}
    >
      {erreur && <Banner tone="erreur" title={erreur} />}
      <Field label="Titre" htmlFor={`${id}-titre`}>
        <TextInput id={`${id}-titre`} value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={TITRE_MAX} />
      </Field>
      <Field label="Description" htmlFor={`${id}-description`} hint="Facultative : ce que la session va aborder.">
        <Textarea id={`${id}-description`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={DESCRIPTION_MAX} rows={4} />
      </Field>
      <div className="flex flex-wrap gap-4">
        <Field label="Date" htmlFor={`${id}-date`} className="min-w-0 flex-[1_1_180px]">
          <TextInput id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Heure" htmlFor={`${id}-heure`} hint="Heure du Bénin." className="min-w-0 flex-[1_1_140px]">
          <TextInput id={`${id}-heure`} type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
        </Field>
        <Field label="Durée" htmlFor={`${id}-duree`} className="min-w-0 flex-[1_1_140px]">
          <Select id={`${id}-duree`} value={duree} onChange={(e) => setDuree(e.target.value)} options={DUREES.map((m) => ({ value: String(m), label: dureeLisible(m) }))} />
        </Field>
      </div>
      <Field label="Lien du live" htmlFor={`${id}-lien`} hint="Google Meet, Zoom… Il s’affiche aux participants 10 min avant le début.">
        <TextInput id={`${id}-lien`} type="url" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="https://meet.google.com/…" maxLength={500} />
      </Field>
      <Field label="Parcours" htmlFor={`${id}-parcours`}>
        <Select
          id={`${id}-parcours`}
          value={parcoursId}
          onChange={(e) => setParcoursId(e.target.value)}
          options={[{ value: "", label: "Tous les parcours" }, ...parcours.map((p) => ({ value: p.id, label: p.nomCourt }))]}
        />
      </Field>
      {espace === "admin" && (
        <Field label="Animateur" htmlFor={`${id}-animateur`}>
          <Select
            id={`${id}-animateur`}
            value={formateurId}
            onChange={(e) => setFormateurId(e.target.value)}
            options={[{ value: "", label: "Équipe Étudium" }, ...(formateurs ?? []).map((f) => ({ value: f.id, label: f.nom }))]}
          />
        </Field>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={envoi}>
          {initial ? "Enregistrer" : "Programmer la session"}
        </Button>
      </div>
    </form>
  );
}
