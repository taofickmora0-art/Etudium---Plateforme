"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import type { Retour } from "@/lib/resultats/actions";
import { ECHEC_RESEAU } from "@/lib/resultats/affichage";

type Champ = "actuel" | "code" | "confirmation";

type NouveauCodeProps = {
  /** Demande d'abord le code actuel (changement de code). */
  avecActuel?: boolean;
  enregistrer: (code: string, actuel: string) => Promise<Retour>;
  /** Après un enregistrement réussi. */
  onFait?: () => void;
  /** Le bouton secondaire, à gauche (« Annuler », « Continuer sans code »). */
  secondaire?: ReactNode;
  /** Les boutons alignés à droite (fenêtre) plutôt que centrés (écran de la porte). */
  aDroite?: boolean;
};

const zoneFocus = (zone: HTMLDivElement | null) => zone?.querySelector("input")?.focus();
/** Après la dernière case, les cases gardent le focus sur elles : on passe au champ suivant juste après. */
const passerA = (zone: HTMLDivElement | null) => setTimeout(() => zoneFocus(zone));

/** Choisir un code à 4 chiffres, deux fois le même (et le code actuel, pour en changer). */
export function NouveauCode({ avecActuel = false, enregistrer, onFait, secondaire, aDroite = false }: NouveauCodeProps) {
  const [actuel, setActuel] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<{ champ: Champ; message: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const zones = useRef<Record<Champ, HTMLDivElement | null>>({ actuel: null, code: null, confirmation: null });

  // Après un refus, le curseur revient dans le champ en cause (une fois les cases réactivées).
  useEffect(() => {
    if (erreur) zoneFocus(zones.current[erreur.champ]);
  }, [erreur]);

  const refuser = (champ: Champ, message: string) => setErreur({ champ, message });

  const valider = async () => {
    if (avecActuel && actuel.length < 4) return refuser("actuel", "Saisis ton code actuel.");
    if (code.length < 4) return refuser("code", "Le code doit faire 4 chiffres.");
    if (confirmation !== code) {
      setConfirmation("");
      return refuser("confirmation", "Les deux codes ne sont pas identiques.");
    }
    setErreur(null);
    setEnvoi(true);
    let retour: Retour;
    try {
      retour = await enregistrer(code, actuel);
    } catch {
      retour = { ok: false, message: ECHEC_RESEAU };
    }
    setEnvoi(false);
    if (retour.ok) {
      onFait?.();
      return;
    }
    // Un refus de la base porte sur le code actuel quand il est demandé (incorrect, trop d'essais), sinon sur le nouveau.
    if (avecActuel) setActuel("");
    refuser(avecActuel ? "actuel" : "code", retour.message);
  };

  const erreurDe = (champ: Champ) => (erreur?.champ === champ ? erreur.message : undefined);

  return (
    <form
      noValidate
      className="flex w-full flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!envoi) void valider();
      }}
    >
      <div className={aDroite ? "flex flex-col gap-4" : "flex flex-col items-center gap-4"}>
        {avecActuel && (
          <div ref={(el) => void (zones.current.actuel = el)}>
            <CodeInput
              label="Ton code actuel"
              length={4}
              masque
              value={actuel}
              onChange={setActuel}
              onComplete={() => passerA(zones.current.code)}
              error={erreurDe("actuel")}
              disabled={envoi}
            />
          </div>
        )}
        <div ref={(el) => void (zones.current.code = el)}>
          <CodeInput
            label="Choisis ton code"
            length={4}
            masque
            value={code}
            onChange={setCode}
            onComplete={() => passerA(zones.current.confirmation)}
            error={erreurDe("code")}
            disabled={envoi}
          />
        </div>
        <div ref={(el) => void (zones.current.confirmation = el)}>
          <CodeInput label="Confirme ton code" length={4} masque value={confirmation} onChange={setConfirmation} error={erreurDe("confirmation")} disabled={envoi} />
        </div>
      </div>
      <div className={aDroite ? "flex flex-wrap justify-end gap-2 max-sm:flex-col-reverse max-sm:[&>*]:w-full" : "flex flex-wrap justify-center gap-2 max-sm:flex-col-reverse max-sm:[&>*]:w-full"}>
        {secondaire}
        <Button type="submit" loading={envoi}>
          Enregistrer mon code
        </Button>
      </div>
    </form>
  );
}
