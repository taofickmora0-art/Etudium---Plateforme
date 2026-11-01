"use client";

import { useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import type { Formule } from "@/lib/abonnement/types";
import { chercherComptes } from "@/lib/utilisateurs/actions";
import { nomAffiche } from "@/lib/utilisateurs/regles";
import type { CompteResume } from "@/lib/utilisateurs/types";
import { FenetreAttribution } from "./FenetreAttribution";

/**
 * « Attribuer un abonnement » depuis la page des paiements (0054) : on cherche d'abord le compte (nom ou adresse, parmi
 * les étudiants), puis la même fenêtre que sur la fiche du compte.
 */
export function BoutonAttribuer({ formules }: { formules: Formule[] }) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<CompteResume[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [choisi, setChoisi] = useState<{ id: string; nom: string } | null>(null);

  function fermer() {
    setOuvert(false);
    setRecherche("");
    setResultats(null);
    setErreur(null);
  }

  async function chercher() {
    if (!recherche.trim()) return;
    setOccupe(true);
    const r = await chercherComptes(recherche.trim(), "etudiants", 1);
    setOccupe(false);
    if (r.ok) {
      setResultats(r.page.comptes.slice(0, 10));
      setErreur(null);
    } else setErreur(r.message);
  }

  return (
    <>
      <Button onClick={() => setOuvert(true)}>Attribuer un abonnement</Button>
      {ouvert && (
        <Dialog
          open
          onOpenChange={(o) => !o && fermer()}
          title="Attribuer un abonnement"
          description="Pour un paiement reçu hors plateforme, ou un abonnement offert. Cherchez d’abord le compte de la personne."
          className="sm:max-w-[520px]"
        >
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void chercher();
            }}
          >
            <div className="flex items-end gap-2">
              <Field label="Compte (nom ou adresse e-mail)" htmlFor="attribution-compte" className="min-w-0 flex-1">
                <TextInput id="attribution-compte" autoComplete="off" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
              </Field>
              <Button type="submit" variant="contour" loading={occupe}>
                Chercher
              </Button>
            </div>
            {erreur && <Banner tone="erreur" title={erreur} />}
            {resultats && resultats.length === 0 && <p className="m-0 text-sm leading-[22px] text-discret">Aucun compte étudiant ne correspond.</p>}
            {resultats && resultats.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {resultats.map((c) => {
                  const nom = nomAffiche(c.prenom, c.nom);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setChoisi({ id: c.id, nom: nom === "Sans nom" ? c.email : nom });
                          fermer();
                        }}
                        className="focus-etudium flex w-full cursor-pointer flex-col items-start rounded-champ border-0 bg-transparent px-3 py-2 text-left hover:bg-page"
                      >
                        <span className="text-sm leading-[22px] font-medium text-encre">{nom}</span>
                        <span className="text-[13px] leading-5 text-discret">{c.email}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </form>
        </Dialog>
      )}
      {choisi && <FenetreAttribution compte={choisi} formules={formules} onFermer={() => setChoisi(null)} />}
    </>
  );
}
