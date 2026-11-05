"use client";

import { useEffect, useRef, useState } from "react";
import { LockPasswordIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import { Dialog, DialogClose } from "@/components/ui/Dialog";
import { useToastFacultatif } from "@/components/ui/Toast";
import { changerPin, creerPin, retirerPin, verrouillerResultats, type Retour } from "@/lib/resultats/actions";
import { ECHEC_RESEAU } from "@/lib/resultats/affichage";
import { NouveauCode } from "./NouveauCode";

type Vue = "menu" | "changer" | "retirer";

const TITRES: Record<Vue, string> = { menu: "Sécurité de tes résultats", changer: "Changer de code", retirer: "Retirer le code" };

/** Retirer le code : le code actuel le confirme. */
function RetraitCode({ onRetour, onFait }: { onRetour: () => void; onFait: () => void }) {
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<{ message: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const zone = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (erreur) zone.current?.querySelector("input")?.focus();
  }, [erreur]);

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (envoi) return;
        if (code.length < 4) return setErreur({ message: "Saisis ton code actuel." });
        setEnvoi(true);
        let retour: Retour;
        try {
          retour = await retirerPin(code);
        } catch {
          retour = { ok: false, message: ECHEC_RESEAU };
        }
        setEnvoi(false);
        if (retour.ok) return onFait();
        setCode("");
        setErreur({ message: retour.message });
      }}
    >
      <div ref={zone}>
        <CodeInput label="Ton code actuel" length={4} masque centre value={code} onChange={setCode} error={erreur?.message} disabled={envoi} />
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-sm:flex-col-reverse max-sm:[&>*]:w-full">
        <Button variant="contour" onClick={onRetour}>
          Retour
        </Button>
        <Button type="submit" variant="danger" loading={envoi}>
          Retirer mon code
        </Button>
      </div>
    </form>
  );
}

/** Le bouton « Sécurité » et sa fenêtre : reverrouiller, changer ou retirer le code ; en créer un s'il n'y en a pas. */
export function SecuriteResultats({ pin }: { pin: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [vue, setVue] = useState<Vue>("menu");
  const toast = useToastFacultatif();

  const fermer = (message?: string) => {
    setOuvert(false);
    if (message) toast?.({ tone: "reussite", title: message });
  };
  const retour = (
    <Button variant="contour" onClick={() => setVue("menu")}>
      Retour
    </Button>
  );

  const description = vue === "retirer" ? "Tes résultats ne seront plus protégés." : vue === "menu" && !pin ? "Aucun code ne protège tes résultats." : undefined;

  return (
    <>
      <Button
        variant="contour"
        iconLeft={LockPasswordIcon}
        onClick={() => {
          setVue("menu");
          setOuvert(true);
        }}
      >
        Sécurité
      </Button>
      <Dialog open={ouvert} onOpenChange={setOuvert} title={TITRES[vue]} description={description}
        icon={LockPasswordIcon}
        iconTone="information"
        // Un code se saisit au centre : titre, cases et boutons.
        className="text-center [&>span]:mx-auto"
      >
        {vue === "changer" ? (
          <NouveauCode avecActuel enregistrer={(code, actuel) => changerPin(actuel, code)} onFait={() => fermer("Ton nouveau code est enregistré.")} secondaire={retour} />
        ) : vue === "retirer" ? (
          <RetraitCode onRetour={() => setVue("menu")} onFait={() => fermer("Ton code est retiré.")} />
        ) : pin ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="principal"
              onClick={() => {
                fermer();
                // L'action rafraîchit la page : le clavier remplace aussitôt le contenu.
                void verrouillerResultats();
              }}
            >
              Reverrouiller maintenant
            </Button>
            <Button variant="contour" onClick={() => setVue("changer")}>
              Changer de code
            </Button>
            <Button variant="dangerDoux" onClick={() => setVue("retirer")}>
              Retirer le code
            </Button>
          </div>
        ) : (
          <NouveauCode
            enregistrer={(code) => creerPin(code)}
            onFait={() => fermer("Ton code est enregistré.")}
            secondaire={
              <DialogClose asChild>
                <Button variant="contour">Annuler</Button>
              </DialogClose>
            }
          />
        )}
      </Dialog>
    </>
  );
}
