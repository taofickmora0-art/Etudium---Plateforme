"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleIcon, LockPasswordIcon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { IconTile } from "@/components/ui/IconTile";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Tag } from "@/components/ui/Tag";
import { authErrorMessage } from "@/lib/auth/messages";
import { fieldErrorsFrom, IDLE, newPasswordSchema, type FormState } from "@/lib/auth/schemas";
import { changePassword, creerMotDePasse, envoyerCodeMotDePasse } from "@/lib/profile/actions";
import type { ProfileData } from "@/lib/profile/data";
import { DeleteAccountCard } from "./DeleteAccountCard";

const CARTE = "rounded-carte border border-bordure-carte bg-panneau";
const GRILLE = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(220px,calc((100%-16px)/2))),1fr))] items-start gap-4";

/**
 * Un compte Google crée son mot de passe (demande du 14 novembre 2026) : le mot de passe et sa confirmation, puis un code
 * à 6 chiffres envoyé à l'adresse du compte, qui prouve que c'est bien la sienne.
 */
function CreerMotDePasse({ email }: { email: string }) {
  const router = useRouter();
  const [etape, setEtape] = useState<"ferme" | "formulaire" | "code">("ferme");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [erreurs, setErreurs] = useState<FormState["fieldErrors"]>({});
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [cree, setCree] = useState(false);

  async function envoyerCode() {
    setMessage(null);
    const verifie = newPasswordSchema.safeParse({ password: motDePasse, confirmation });
    if (!verifie.success) {
      setErreurs(fieldErrorsFrom(verifie.error));
      return;
    }
    setErreurs({});
    setOccupe(true);
    try {
      const r = await envoyerCodeMotDePasse();
      if (r.ok) {
        setCode("");
        setEtape("code");
      } else setMessage(r.message);
    } catch {
      // Coupure réseau : on le dit, au lieu de l'écran d'erreur.
      setMessage(authErrorMessage(null));
    } finally {
      setOccupe(false);
    }
  }

  async function confirmer() {
    setMessage(null);
    const donnees = new FormData();
    donnees.set("password", motDePasse);
    donnees.set("confirmation", confirmation);
    donnees.set("code", code);
    setOccupe(true);
    try {
      const r = await creerMotDePasse(IDLE, donnees);
      if (r.status === "success") {
        setCree(true);
        return;
      }
      setErreurs(r.fieldErrors ?? {});
      if (r.fieldErrors?.password || r.fieldErrors?.confirmation) setEtape("formulaire");
      if (r.message) setMessage(r.message);
    } catch {
      setMessage(authErrorMessage(null));
    } finally {
      setOccupe(false);
    }
  }

  if (etape === "ferme") {
    return (
      <div className="flex justify-end">
        <Button onClick={() => setEtape("formulaire")}>Créer un mot de passe</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {message && <Banner tone="erreur" title={message} />}
      {etape === "formulaire" ? (
        <>
          <div className={GRILLE}>
            <Field label="Nouveau mot de passe" htmlFor="securite-creer" hint="Au moins 8 caractères." error={erreurs?.password}>
              <PasswordInput id="securite-creer" autoComplete="new-password" minLength={8} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
            </Field>
            <Field label="Confirmer le mot de passe" htmlFor="securite-creer-confirmation" error={erreurs?.confirmation}>
              <PasswordInput id="securite-creer-confirmation" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2 max-sm:flex-col-reverse max-sm:[&>*]:w-full">
            <Button variant="contour" onClick={() => setEtape("ferme")} disabled={occupe}>
              Annuler
            </Button>
            <Button onClick={() => void envoyerCode()} loading={occupe}>
              Recevoir le code
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="m-0 text-sm leading-[22px] text-texte">{`Un code à 6 chiffres a été envoyé à ${email}.`}</p>
          <CodeInput label="Code reçu par e-mail" length={6} value={code} onChange={setCode} error={erreurs?.code} disabled={occupe} />
          <div className="flex flex-wrap justify-end gap-2 max-sm:flex-col-reverse max-sm:[&>*]:w-full">
            <Button variant="contour" onClick={() => void envoyerCode()} disabled={occupe}>
              Renvoyer le code
            </Button>
            <Button onClick={() => void confirmer()} loading={occupe} disabled={code.length < 6}>
              Confirmer
            </Button>
          </div>
        </>
      )}
      <Dialog
        open={cree}
        onOpenChange={(ouverte) => {
          if (!ouverte) router.refresh();
          setCree(ouverte);
        }}
        icon={LockPasswordIcon}
        iconTone="reussite"
        title="Mot de passe créé"
        description="Vous pouvez maintenant vous connecter avec votre adresse e-mail et ce mot de passe, ou avec Google."
        footer={
          <Button
            onClick={() => {
              setCree(false);
              router.refresh();
            }}
          >
            Compris
          </Button>
        }
      />
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
