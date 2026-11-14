"use client";

import { useActionState, useState } from "react";
import { GoogleIcon, LockPasswordIcon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { IconTile } from "@/components/ui/IconTile";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Tag } from "@/components/ui/Tag";
import { authErrorMessage } from "@/lib/auth/messages";
import { IDLE, type FormState } from "@/lib/auth/schemas";
import { changePassword, envoyerLienMotDePasse } from "@/lib/profile/actions";
import type { ProfileData } from "@/lib/profile/data";
import { DeleteAccountCard } from "./DeleteAccountCard";

const CARTE = "rounded-carte border border-bordure-carte bg-panneau";
const GRILLE = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(220px,calc((100%-16px)/2))),1fr))] items-start gap-4";

/** Un compte Google crée son mot de passe par un lien reçu à son adresse (14 novembre 2026). */
function CreerMotDePasse({ email }: { email: string }) {
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await envoyerLienMotDePasse();
      if (r.ok) setEnvoye(true);
      else setErreur(r.message);
    } catch {
      // Coupure réseau : on le dit, au lieu de l'écran d'erreur.
      setErreur(authErrorMessage(null));
    } finally {
      setEnvoi(false);
    }
  }

  if (envoye) return <Banner tone="reussite" title={`Lien envoyé à ${email} : ouvrez-le pour choisir votre mot de passe.`} />;
  return (
    <div className="flex flex-col gap-4">
      {erreur && <Banner tone="erreur" title={erreur} />}
      <div className="flex justify-end">
        <Button onClick={() => void envoyer()} loading={envoi}>
          Créer un mot de passe
        </Button>
      </div>
    </div>
  );
}

function MotDePasse({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const [confirme, setConfirme] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData): Promise<FormState> => {
    try {
      const resultat = await changePassword(prev, formData);
      if (resultat.status === "success") setConfirme(true);
      return resultat;
    } catch {
      // Coupure réseau : on le dit, au lieu de l'écran d'erreur.
      return { status: "error", message: authErrorMessage(null) };
    }
  }, IDLE);

  return (
    <div className={`${CARTE} flex flex-col gap-5 p-6`}>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-xl leading-7 font-semibold text-encre">Mot de passe</h2>
        <p className="m-0 text-sm leading-[22px] text-pretty text-discret">
          {hasPassword
            ? "Après la mise à jour, les autres appareils seront déconnectés."
            : "Vous vous connectez avec Google. Créez un mot de passe pour vous connecter aussi avec votre adresse e-mail."}
        </p>
      </div>
      {!hasPassword && <CreerMotDePasse email={email} />}
      {hasPassword && (
        <form action={action} noValidate className="flex flex-col gap-5">
          {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}
          <div className={GRILLE}>
            <Field label="Mot de passe actuel" htmlFor="securite-actuel" error={state.fieldErrors?.current}>
              <PasswordInput id="securite-actuel" name="current" autoComplete="current-password" required />
            </Field>
            <Field label="Nouveau mot de passe" htmlFor="securite-nouveau" hint="Au moins 8 caractères." error={state.fieldErrors?.password}>
              <PasswordInput id="securite-nouveau" name="password" autoComplete="new-password" minLength={8} required />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={pending}>
              Mettre à jour
            </Button>
          </div>
        </form>
      )}
      <Dialog
        open={confirme}
        onOpenChange={setConfirme}
        icon={LockPasswordIcon}
        iconTone="reussite"
        title="Mot de passe mis à jour"
        description="Cet appareil reste connecté. Les autres appareils ont été déconnectés."
        footer={<Button onClick={() => setConfirme(false)}>Compris</Button>}
      />
    </div>
  );
}

/** Onglet Sécurité (NdProfil, NdMotDePasseModifie) : mot de passe, Google, suppression du compte. */
export function SecurityTab({ profile }: { profile: ProfileData }) {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-4">
        <MotDePasse hasPassword={profile.hasPassword} email={profile.email} />
        {profile.googleLinked && (
          <div className={`${CARTE} flex flex-wrap items-center gap-x-3.5 gap-y-3 px-6 py-[18px]`}>
            <IconTile icon={GoogleIcon} size={44} />
            <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
              <span className="text-[15px] leading-[22px] font-medium text-encre">Connexion avec Google</span>
              <span className="text-[13px] leading-5 text-discret">Associée à {profile.email}</span>
            </div>
            <Tag tone="valide">Active</Tag>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-[1_1_300px]">
        <DeleteAccountCard />
      </div>
    </div>
  );
}
