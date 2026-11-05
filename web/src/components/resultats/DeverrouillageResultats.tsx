"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { signOut } from "@/lib/auth/actions";
import { loadFullPage } from "@/lib/full-page";
import { ouvrirResultats, type Retour } from "@/lib/resultats/actions";
import { ECHEC_RESEAU } from "@/lib/resultats/affichage";
import { CadrePorte } from "./CadrePorte";

/** Où revenir après la reconnexion d'un code oublié : l'écran du nouveau code. */
export const RETOUR_OUBLI = "/mes-resultats?oubli=1";

const minutesRestantes = (jusqua: string | null, maintenant: number) => {
  const fin = jusqua ? Date.parse(jusqua) : NaN;
  return Number.isFinite(fin) && fin > maintenant ? Math.ceil((fin - maintenant) / 60_000) : 0;
};

/** « 12 minutes », puis en heures à partir d'une heure (comme la base, migration 0078). */
const attente = (minutes: number) => {
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  const heures = Math.ceil(minutes / 60);
  return `${heures} heure${heures > 1 ? "s" : ""}`;
};

const messageBlocage = (minutes: number) => `Trop d’essais : réessaie dans ${attente(minutes)}.`;

/** Le clavier de la porte : 4 chiffres masqués, envoyés dès la dernière case ; « Code oublié ? » passe par une reconnexion. */
export function DeverrouillageResultats({ bloqueJusqua }: { bloqueJusqua: string | null }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const bloque = minutesRestantes(bloqueJusqua, maintenant);
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<{ message: string } | null>(bloque ? { message: messageBlocage(bloque) } : null);
  const [envoi, setEnvoi] = useState(false);
  const [oubli, setOubli] = useState(false);
  const zone = useRef<HTMLDivElement>(null);

  // À la fin du blocage, les cases se rouvrent d'elles-mêmes.
  useEffect(() => {
    if (!bloque || !bloqueJusqua) return;
    const minuterie = setTimeout(() => {
      setMaintenant(Date.now());
      setErreur(null);
    }, Date.parse(bloqueJusqua) - maintenant + 250);
    return () => clearTimeout(minuterie);
  }, [bloque, bloqueJusqua, maintenant]);

  // Après un refus, les cases vides reprennent le focus (une fois réactivées).
  useEffect(() => {
    if (erreur) zone.current?.querySelector("input")?.focus();
  }, [erreur]);

  const essayer = async (valeur: string) => {
    setEnvoi(true);
    setErreur(null);
    let retour: Retour;
    try {
      retour = await ouvrirResultats(valeur);
    } catch {
      retour = { ok: false, message: ECHEC_RESEAU };
    }
    // Ouvert, la page se recharge d'elle-même (l'action rafraîchit) : les cases restent occupées jusque-là.
    if (retour.ok) return;
    setEnvoi(false);
    setCode("");
    setErreur({ message: retour.message });
  };

  return (
    <>
      <CadrePorte titre="Saisis ton code">
        <div ref={zone}>
          <CodeInput
            label="Ton code PIN"
            length={4}
            masque
            centre
            value={code}
            onChange={setCode}
            onComplete={(valeur) => void essayer(valeur)}
            error={erreur?.message}
            disabled={envoi || bloque > 0}
          />
        </div>
        <Button variant="discret" size="sm" onClick={() => setOubli(true)}>
          Code oublié ?
        </Button>
      </CadrePorte>
      <ConfirmDialog
        open={oubli}
        onOpenChange={setOubli}
        title="Code oublié ?"
        description="Reconnecte-toi pour créer un nouveau code. Tes résultats sont gardés."
        confirmLabel="Me reconnecter"
        onConfirm={async () => {
          await signOut();
          loadFullPage(`/connexion?next=${encodeURIComponent(RETOUR_OUBLI)}`);
        }}
      />
    </>
  );
}
