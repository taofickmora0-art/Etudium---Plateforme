"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { Role } from "@/lib/auth/permissions";
import { changerRoles } from "@/lib/utilisateurs/actions";
import { LIBELLES_ROLES, resumeChangement, ROLES_ORDONNES } from "@/lib/utilisateurs/regles";
import type { CompteDetail } from "@/lib/utilisateurs/types";
import { Section } from "./Section";

const NOUVELLE = "__nouvelle__";
const ECHEC = "Les rôles n’ont pas pu être enregistrés. Réessayez.";

type Props = {
  compte: CompteDetail;
  /** Fiches formateur pas encore reliées à un compte (choix en donnant le rôle Formateur). */
  fichesLibres: { id: string; nom: string }[];
  /** Le super admin seul change les rôles ; les autres les voient. */
  modifiable: boolean;
};

/**
 * Rôles d'un compte (spec des utilisateurs, §3). Étudiant est toujours coché ; Formateur, sans fiche reliée, demande
 * une fiche (existante libre, ou créée à son nom) ; la confirmation résume le changement. La base revérifie tout et
 * son refus (« Vous ne pouvez pas vous retirer le rôle super admin. »…) est affiché tel quel.
 */
export function RolesCompte({ compte, fichesLibres, modifiable }: Props) {
  const { toast } = useToast();
  const idFiche = useId();
  const [coches, setCoches] = useState<Set<Role>>(() => new Set(compte.roles));
  const [fiche, setFiche] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState(ECHEC);

  const apres = ROLES_ORDONNES.filter((r) => r === "etudiant" || coches.has(r));
  const resume = resumeChangement(compte.roles, apres);
  const besoinFiche = coches.has("formateur") && !compte.ficheFormateur;
  const pret = resume !== "Aucun changement." && (!besoinFiche || fiche !== "");

  const basculer = (role: Role) =>
    setCoches((avant) => {
      const suite = new Set(avant);
      if (suite.has(role)) suite.delete(role);
      else suite.add(role);
      return suite;
    });

  return (
    <Section titre="Rôles">
      <div className="flex flex-col gap-3">
        {ROLES_ORDONNES.map((r) => (
          <Checkbox
            key={r}
            label={LIBELLES_ROLES[r]}
            checked={r === "etudiant" || coches.has(r)}
            disabled={r === "etudiant" || !modifiable}
            onChange={() => basculer(r)}
          />
        ))}
      </div>
      {compte.ficheFormateur && (
        <p className="m-0 text-sm leading-[22px] text-texte">
          Fiche formateur :{" "}
          <Link href={`/admin/formateurs/${compte.ficheFormateur.id}`} className="focus-etudium font-medium text-bleu underline-offset-2 hover:underline">
            {compte.ficheFormateur.nom}
          </Link>
        </p>
      )}
      {besoinFiche && modifiable && (
        <Field label="Fiche formateur" htmlFor={idFiche} hint="Ses formations seront celles de son espace formateur.">
          <Select
            id={idFiche}
            value={fiche}
            onChange={(e) => setFiche(e.target.value)}
            options={[
              { value: "", label: "Choisir une fiche…" },
              ...fichesLibres.map((f) => ({ value: f.id, label: f.nom })),
              { value: NOUVELLE, label: "Créer une fiche à son nom" },
            ]}
          />
        </Field>
      )}
      {modifiable ? (
        <div>
          <Button type="button" disabled={!pret} onClick={() => setConfirmation(true)}>
            Enregistrer les rôles
          </Button>
        </div>
      ) : (
        <p className="m-0 text-sm leading-[22px] text-discret">Seul le super admin change les rôles.</p>
      )}
      <ConfirmDialog
        open={confirmation}
        onOpenChange={setConfirmation}
        title="Changer les rôles de ce compte ?"
        description={resume}
        confirmLabel="Enregistrer"
        errorMessage={erreur}
        onConfirm={async () => {
          const choix = besoinFiche ? (fiche === NOUVELLE ? { nouvelle: true as const } : { existante: fiche }) : null;
          const reponse = await changerRoles(compte.id, apres, choix);
          if (!reponse.ok) {
            setErreur(reponse.message ?? ECHEC);
            throw new Error(reponse.message);
          }
          setFiche("");
          toast({ tone: "reussite", title: "Rôles enregistrés." });
        }}
      />
    </Section>
  );
}
