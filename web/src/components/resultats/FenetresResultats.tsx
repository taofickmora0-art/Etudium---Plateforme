"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ChampDate } from "@/components/ui/ChampDate";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { enregistrerEcue, enregistrerNote, enregistrerSemestre, enregistrerUe, supprimerElement, type Retour, type TypeElement } from "@/lib/resultats/actions";
import { formaterNombre, lireNombre } from "@/lib/resultats/affichage";
import { refusBareme, refusCredits, refusNote, refusPoids } from "@/lib/resultats/regles";
import type { Ecue, Note, Parcours, Regles, Semestre, Ue } from "@/lib/resultats/types";
import { categoriesDuBareme, ChoixBareme, etatBareme } from "./ChoixBareme";
import { FenetreParcours } from "./FenetreParcours";
import { FenetreSaisie } from "./FenetreSaisie";

/** La fenêtre ouverte sur la vue d'un parcours (une seule à la fois). */
export type Fenetre =
  | { quoi: "parcours" }
  | { quoi: "semestre"; semestre?: Semestre }
  | { quoi: "ue"; semestreId: string; ue?: Ue }
  | { quoi: "ecue"; ueId: string; ecue?: Ecue }
  | { quoi: "note"; ecue: Ecue; note?: Note }
  | { quoi: "supprimer"; type: TypeElement; id: string; titre: string; description: string; apres?: () => void };

export type OuvrirFenetre = (fenetre: Fenetre) => void;

const refuser = (message: string): Retour => ({ ok: false, message });

function FenetreSemestre({ parcoursId, semestre, rang, onFermer }: { parcoursId: string; semestre?: Semestre; rang: number; onFermer: () => void }) {
  const router = useRouter();
  const id = useId();
  const [nom, setNom] = useState(semestre?.nom ?? `Semestre ${rang}`);
  const [annee, setAnnee] = useState(semestre?.annee ?? "");
  return (
    <FenetreSaisie
      titre={semestre ? "Modifier le semestre" : "Nouveau semestre"}
      bouton={semestre ? "Enregistrer" : "Ajouter le semestre"}
      onFermer={onFermer}
      envoyer={() =>
        nom.trim() ? enregistrerSemestre({ ...(semestre ? { id: semestre.id } : {}), parcoursId, nom: nom.trim(), annee: annee.trim() }) : refuser("Donne un nom au semestre.")
      }
      onFait={(retour) => !semestre && retour.id && router.push(`/mes-resultats/${parcoursId}?semestre=${retour.id}`)}
    >
      <Field label="Nom" htmlFor={`${id}-nom`}>
        <TextInput id={`${id}-nom`} maxLength={60} value={nom} onChange={(e) => setNom(e.target.value)} />
      </Field>
      <Field label="Année universitaire" htmlFor={`${id}-annee`} hint="Facultatif : elle sert à la moyenne de chaque année.">
        <TextInput id={`${id}-annee`} maxLength={20} placeholder="2025-2026" value={annee} onChange={(e) => setAnnee(e.target.value)} />
      </Field>
    </FenetreSaisie>
  );
}

function FenetreUe({ semestreId, ue, onFermer }: { semestreId: string; ue?: Ue; onFermer: () => void }) {
  const id = useId();
  const [code, setCode] = useState(ue?.code ?? "");
  const [intitule, setIntitule] = useState(ue?.intitule ?? "");
  const [credits, setCredits] = useState(ue ? formaterNombre(ue.credits) : "");
  return (
    <FenetreSaisie
      titre={ue ? "Modifier l’UE" : "Nouvelle UE"}
      description="Une unité d’enseignement, avec ses crédits."
      bouton={ue ? "Enregistrer" : "Ajouter l’UE"}
      onFermer={onFermer}
      envoyer={() => {
        const valeur = lireNombre(credits);
        if (!intitule.trim()) return refuser("Donne un intitulé à l’UE.");
        const refus = refusCredits(valeur);
        if (refus) return refuser(refus);
        return enregistrerUe({ ...(ue ? { id: ue.id } : {}), semestreId, code: code.trim(), intitule: intitule.trim(), credits: valeur });
      }}
    >
      <Field label="Code" htmlFor={`${id}-code`} hint="Facultatif.">
        <TextInput id={`${id}-code`} maxLength={20} placeholder="UE 101" value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      <Field label="Intitulé" htmlFor={`${id}-intitule`}>
        <TextInput id={`${id}-intitule`} maxLength={120} placeholder="Agronomie générale" value={intitule} onChange={(e) => setIntitule(e.target.value)} />
      </Field>
      <Field label="Crédits" htmlFor={`${id}-credits`}>
        <TextInput id={`${id}-credits`} inputMode="decimal" placeholder="5" value={credits} onChange={(e) => setCredits(e.target.value)} />
      </Field>
    </FenetreSaisie>
  );
}

function FenetreEcue({ ueId, ecue, regles, onFermer }: { ueId: string; ecue?: Ecue; regles: Regles; onFermer: () => void }) {
  const id = useId();
  const [intitule, setIntitule] = useState(ecue?.intitule ?? "");
  const [poids, setPoids] = useState(ecue ? formaterNombre(ecue.poids) : "1");
  const [bareme, setBareme] = useState(() => etatBareme(ecue?.bareme ?? null, regles.categories));
  return (
    <FenetreSaisie
      titre={ecue ? "Modifier l’ECUE" : "Nouvelle ECUE"}
      description="Une matière de l’UE. Ses crédits (ou son coefficient) pèsent dans la moyenne de l’UE."
      bouton={ecue ? "Enregistrer" : "Ajouter l’ECUE"}
      onFermer={onFermer}
      envoyer={() => {
        const valeur = lireNombre(poids);
        const categories = categoriesDuBareme(bareme);
        const refus = (!intitule.trim() && "Donne un intitulé à l’ECUE.") || refusPoids(valeur) || (categories && refusBareme(categories));
        if (refus) return refuser(refus);
        return enregistrerEcue({ ...(ecue ? { id: ecue.id } : {}), ueId, intitule: intitule.trim(), poids: valeur, bareme: categories });
      }}
    >
      <Field label="Intitulé" htmlFor={`${id}-intitule`}>
        <TextInput id={`${id}-intitule`} maxLength={120} placeholder="Physiologie végétale" value={intitule} onChange={(e) => setIntitule(e.target.value)} />
      </Field>
      <Field label="Crédits ou coefficient" htmlFor={`${id}-poids`}>
        <TextInput id={`${id}-poids`} inputMode="decimal" value={poids} onChange={(e) => setPoids(e.target.value)} />
      </Field>
      <ChoixBareme name={`${id}-bareme`} etat={bareme} onChange={setBareme} parcours={regles.categories} />
    </FenetreSaisie>
  );
}

const RATTRAPAGE = "rattrapage";

function FenetreNote({ ecue, note, regles, onFermer }: { ecue: Ecue; note?: Note; regles: Regles; onFermer: () => void }) {
  const id = useId();
  const bareme = ecue.bareme ?? regles.categories;
  const examen = bareme.find((c) => c.examen);
  const options = [...bareme.map((c) => ({ value: c.cle, label: c.nom })), ...(examen ? [{ value: RATTRAPAGE, label: `Rattrapage (${examen.nom.toLowerCase()})` }] : [])];
  const depart = note?.rattrapage && examen ? RATTRAPAGE : options.some((o) => o.value === note?.categorie) ? note!.categorie : options[0].value;
  const [type, setType] = useState(depart);
  const [libelle, setLibelle] = useState(note?.libelle ?? "");
  const [valeur, setValeur] = useState(note ? formaterNombre(note.note) : "");
  const [sur, setSur] = useState(note ? formaterNombre(note.sur) : "20");
  const [date, setDate] = useState(note?.date ?? "");
  return (
    <FenetreSaisie
      titre={note ? "Modifier la note" : "Nouvelle note"}
      description={ecue.intitule}
      bouton={note ? "Enregistrer" : "Ajouter la note"}
      onFermer={onFermer}
      envoyer={() => {
        const n = lireNombre(valeur);
        const s = lireNombre(sur);
        const refus = refusNote(n, s);
        if (refus) return refuser(refus);
        const rattrapage = type === RATTRAPAGE;
        return enregistrerNote({
          ...(note ? { id: note.id } : {}),
          ecueId: ecue.id,
          categorie: rattrapage ? examen!.cle : type,
          libelle: libelle.trim(),
          note: n,
          sur: s,
          rattrapage,
          date: date || null,
        });
      }}
    >
      <Field label="Type" htmlFor={`${id}-type`}>
        <Select id={`${id}-type`} options={options} value={type} onValueChange={setType} />
      </Field>
      <Field label="Libellé" htmlFor={`${id}-libelle`} hint="Facultatif.">
        <TextInput id={`${id}-libelle`} maxLength={60} placeholder="Interrogation 2" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
      </Field>
      <div className="flex gap-3">
        <Field label="Note obtenue" htmlFor={`${id}-note`} className="flex-1">
          <TextInput id={`${id}-note`} inputMode="decimal" placeholder="14,5" value={valeur} onChange={(e) => setValeur(e.target.value)} />
        </Field>
        <Field label="Sur" htmlFor={`${id}-sur`} className="w-24">
          <TextInput id={`${id}-sur`} inputMode="decimal" value={sur} onChange={(e) => setSur(e.target.value)} />
        </Field>
      </div>
      <Field label="Date" htmlFor={`${id}-date`} hint="Facultatif.">
        <ChampDate id={`${id}-date`} value={date} onChange={setDate} />
      </Field>
    </FenetreSaisie>
  );
}

/** La fenêtre ouverte, d'après son genre ; une suppression demande confirmation. */
export function FenetresResultats({ fenetre, onFermer, parcours, nbSemestres }: { fenetre: Fenetre | null; onFermer: () => void; parcours: Parcours; nbSemestres: number }) {
  const router = useRouter();
  if (!fenetre) return null;
  switch (fenetre.quoi) {
    case "parcours":
      return <FenetreParcours parcours={parcours} onFermer={onFermer} />;
    case "semestre":
      return <FenetreSemestre parcoursId={parcours.id} semestre={fenetre.semestre} rang={nbSemestres + 1} onFermer={onFermer} />;
    case "ue":
      return <FenetreUe semestreId={fenetre.semestreId} ue={fenetre.ue} onFermer={onFermer} />;
    case "ecue":
      return <FenetreEcue ueId={fenetre.ueId} ecue={fenetre.ecue} regles={parcours.regles} onFermer={onFermer} />;
    case "note":
      return <FenetreNote ecue={fenetre.ecue} note={fenetre.note} regles={parcours.regles} onFermer={onFermer} />;
    case "supprimer":
      return (
        <ConfirmDialog
          open
          onOpenChange={(ouvert) => !ouvert && onFermer()}
          title={fenetre.titre}
          description={fenetre.description}
          confirmLabel="Supprimer"
          tone="danger"
          onConfirm={async () => {
            const retour = await supprimerElement(fenetre.type, fenetre.id);
            if (!retour.ok) {
              if (retour.verrouille) router.refresh();
              throw new Error(retour.message);
            }
            fenetre.apres?.();
          }}
        />
      );
  }
}
