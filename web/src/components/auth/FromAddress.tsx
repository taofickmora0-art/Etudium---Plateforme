"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { safeNext } from "@/lib/auth/messages";
import { SessionExpiredDialog } from "./SessionExpiredDialog";

// Ce que les écrans de compte lisent dans l'adresse, lu dans le navigateur : les pages restent statiques,
// et un formulaire envoyé avant le chargement du JavaScript reçoit une page complète (pas une page blanche).
// Chaque lecture a son propre Suspense, au plus près : le formulaire, lui, n'attend jamais (rien de tapé n'est perdu).

function ValeurNext() {
  return <input type="hidden" name="next" value={safeNext(useSearchParams().get("next"))} />;
}

/** Champ caché « next » : la page demandée avant la connexion (adresses extérieures refusées). */
export function NextField() {
  return (
    <Suspense fallback={<input type="hidden" name="next" value="/accueil" />}>
      <ValeurNext />
    </Suspense>
  );
}

function AvisDeConnexion() {
  const adresse = useSearchParams();
  return (
    <>
      {adresse.get("session") === "expiree" && <SessionExpiredDialog />}
      {adresse.get("erreur") === "google" && (
        <Banner tone="erreur" title="La connexion avec Google n’a pas abouti.">
          Réessayez ou utilisez votre e-mail.
        </Banner>
      )}
    </>
  );
}

/** Session expirée (NdSessionExpiree) et retour raté de Google, annoncés sur la page de connexion. */
export function SignInNotices() {
  return (
    <Suspense fallback={null}>
      <AvisDeConnexion />
    </Suspense>
  );
}

function AvisLienExpire() {
  if (useSearchParams().get("lien") !== "expire") return null;
  return (
    <Banner tone="attention" title="Ce lien a expiré.">
      Demandez-en un nouveau.
    </Banner>
  );
}

/** Lien « mot de passe oublié » expiré ou déjà utilisé (retour de /auth/confirm). */
export function LinkExpiredNotice() {
  return (
    <Suspense fallback={null}>
      <AvisLienExpire />
    </Suspense>
  );
}
