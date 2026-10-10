"use client";

import { useState, type ReactNode } from "react";
import {
  Alert02Icon,
  AlertCircleIcon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Delete02Icon,
  Download04Icon,
  Exchange01Icon,
  Logout03Icon,
  Mail01Icon,
  SentIcon,
  Share08Icon,
  SquareLock02Icon,
  Time02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CourseIllustration } from "@/components/ui/CourseIllustration";
import { Dialog, DialogClose } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { TextInput } from "@/components/ui/TextInput";
import { TypedConfirmDialog } from "@/components/ui/TypedConfirmDialog";

type Fenetre =
  | "deconnexion"
  | "session"
  | "quitter"
  | "suppression"
  | "motDePasse"
  | "formule"
  | "renouvellement"
  | "attente"
  | "confirme"
  | "echoue"
  | "quiz"
  | "exercice"
  | "certificat"
  | "partage"
  | "live";

const GROUPES: { titre: string; fenetres: [Fenetre, string][] }[] = [
  {
    titre: "Session et compte",
    fenetres: [
      ["deconnexion", "Déconnexion"],
      ["session", "Session expirée"],
      ["quitter", "Modifications non enregistrées"],
      ["suppression", "Suppression du compte"],
      ["motDePasse", "Mot de passe modifié"],
    ],
  },
  {
    titre: "Abonnement et paiement",
    fenetres: [
      ["formule", "Changement de formule"],
      ["renouvellement", "Rappel de renouvellement"],
      ["attente", "Paiement en attente de confirmation"],
      ["confirme", "Paiement réussi"],
      ["echoue", "Paiement échoué"],
    ],
  },
  {
    titre: "Apprentissage",
    fenetres: [
      ["quiz", "Quitter le quiz"],
      ["exercice", "Envoi d’un exercice"],
      ["certificat", "Certificat obtenu"],
      ["partage", "Partage du certificat"],
      ["live", "Inscription à une session live"],
    ],
  },
];

/** Attente simulée pour voir le bouton en chargement. */
const patienter = () => new Promise<void>((resolve) => setTimeout(resolve, 1200));

/** Chaque bouton ouvre la fenêtre correspondante de la planche. */
export function ModalesDemo() {
  const [ouverte, setOuverte] = useState<Fenetre | null>(null);
  const props = (f: Fenetre) => ({ open: ouverte === f, onOpenChange: (open: boolean) => setOuverte(open ? f : null) });
  const fermer = () => setOuverte(null);
  const bouton = (label: ReactNode) => <Button onClick={fermer}>{label}</Button>;

  return (
    <div className="flex flex-col gap-6">
      {GROUPES.map((g) => (
        <div key={g.titre} className="flex flex-col gap-3">
          <h4 className="m-0 text-sm leading-5 font-semibold text-encre">{g.titre}</h4>
          <div className="flex flex-wrap gap-2">
            {g.fenetres.map(([f, label]) => (
              <Button key={f} variant="contour" size="sm" onClick={() => setOuverte(f)}>
                {label}
              </Button>
            ))}
          </div>
        </div>
      ))}

      <ConfirmDialog
        {...props("deconnexion")}
        icon={Logout03Icon}
        title="Se déconnecter ?"
        description="Votre progression est enregistrée. Vous devrez saisir à nouveau vos identifiants pour revenir."
        confirmLabel="Se déconnecter"
        onConfirm={patienter}
      />
      <Dialog
        {...props("session")}
        dismissible={false}
        icon={Time02Icon}
        title="Votre session a expiré"
        description="Par sécurité, reconnectez-vous pour continuer. Votre progression est enregistrée."
        footer={bouton("Se reconnecter")}
      />
      <ConfirmDialog
        {...props("quitter")}
        tone="danger"
        icon={Alert02Icon}
        iconTone="attention"
        title="Quitter sans enregistrer ?"
        description="Les modifications apportées à cette page seront perdues."
        cancelLabel="Rester sur la page"
        confirmLabel="Quitter sans enregistrer"
        onConfirm={() => {}}
      />
      <TypedConfirmDialog
        {...props("suppression")}
        tone="danger"
        icon={Delete02Icon}
        title="Supprimer votre compte ?"
        description="Cette action est définitive. Vos formations et votre progression seront supprimées. Vos certificats déjà délivrés resteront vérifiables."
        confirmLabel="Supprimer mon compte"
        confirmWord="SUPPRIMER"
        onConfirm={patienter}
      />
      <Dialog
        {...props("motDePasse")}
        icon={SquareLock02Icon}
        iconTone="reussite"
        title="Mot de passe mis à jour"
        description="Vous restez connectée sur cet appareil. Les autres appareils ont été déconnectés."
        footer={bouton("Compris")}
      />

      <ConfirmDialog
        {...props("formule")}
        icon={Exchange01Icon}
        iconTone="information"
        title="Passer à la formule Premium ?"
        description="Le changement est immédiat : vous ne payez que la différence au prorata, soit [PRIX] FCFA. Tous les parcours seront débloqués."
        confirmLabel="Continuer vers le paiement"
        onConfirm={() => {}}
      />
      <ConfirmDialog
        {...props("renouvellement")}
        icon={Alert02Icon}
        iconTone="attention"
        title="Votre formule Standard expire dans 5 jours"
        description="Renouvelez pour garder l’accès à vos formations. Rien ne sera supprimé si vous attendez."
        cancelLabel="Plus tard"
        confirmLabel="Renouveler"
        onConfirm={() => {}}
      />
      <Dialog
        {...props("attente")}
        title="Confirmez sur votre téléphone"
        description="Une demande de [PRIX] FCFA a été envoyée au 01 97 00 00 00. Saisissez votre code secret Mobile Money pour valider."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="contour">Annuler le paiement</Button>
            </DialogClose>
            <Button variant="gris">Renvoyer la demande</Button>
          </>
        }
      >
        <div role="status" className="flex items-center gap-3 rounded-bouton bg-page px-4 py-3.5">
          <Spinner size={22} className="text-bleu" />
          <span className="text-sm leading-[22px] font-medium text-encre">En attente de votre confirmation…</span>
        </div>
      </Dialog>
      <Dialog
        {...props("confirme")}
        icon={CheckmarkCircle02Icon}
        iconTone="reussite"
        title="Paiement confirmé"
        description="Votre formule Standard est active jusqu’au 14 novembre 2026. Un reçu vous a été envoyé par e-mail."
        footer={
          <>
            <Button variant="contour" iconLeft={Download04Icon}>
              Télécharger le reçu
            </Button>
            {bouton("Aller à mon tableau de bord")}
          </>
        }
      />
      <Dialog
        {...props("echoue")}
        icon={AlertCircleIcon}
        iconTone="danger"
        title="Le paiement n’a pas abouti"
        description="Aucun montant n’a été débité. Vérifiez votre solde Mobile Money ou essayez un autre opérateur."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="contour">Changer d’opérateur</Button>
            </DialogClose>
            {bouton("Réessayer")}
          </>
        }
      />

      <ConfirmDialog
        {...props("quiz")}
        tone="danger"
        icon={Alert02Icon}
        iconTone="attention"
        title="Quitter le quiz ?"
        description="Vos réponses ne seront pas enregistrées. Vous pourrez recommencer le quiz plus tard."
        cancelLabel="Continuer le quiz"
        confirmLabel="Quitter"
        onConfirm={() => {}}
      />
      <ConfirmDialog
        {...props("exercice")}
        icon={SentIcon}
        iconTone="information"
        title="Envoyer votre travail ?"
        description="Votre formatrice recevra « Tableau_ventes.xlsx ». Vous ne pourrez plus le modifier tant qu’il n’est pas corrigé."
        confirmLabel="Envoyer"
        onConfirm={patienter}
      />
      <Dialog
        {...props("certificat")}
        title="Félicitations, Aïcha !"
        description="Vous avez validé « Zotero : gérer ses références ». Votre certificat est prêt, avec son QR Code de vérification."
        footer={
          <>
            <Button variant="contour" iconLeft={Share08Icon} onClick={() => setOuverte("partage")}>
              Partager
            </Button>
            {bouton("Voir mon certificat")}
          </>
        }
      >
        <div className="flex justify-center rounded-carte bg-page p-5">
          <CourseIllustration parcours="academique" size={96} />
        </div>
      </Dialog>
      <Dialog
        {...props("partage")}
        icon={Share08Icon}
        iconTone="information"
        title="Partager votre certificat"
        description="Toute personne disposant du lien peut vérifier son authenticité."
        footer={bouton("Fermer")}
      >
        <div className="flex min-w-0 flex-col gap-3.5">
          <Field label="Lien de vérification" htmlFor="v-lien">
            <span className="relative block">
              <TextInput id="v-lien" readOnly value="etudium.app/c/[CODE]" className="pr-28" />
              <Button variant="gris" size="sm" iconLeft={Copy01Icon} className="absolute top-1.5 right-1.5">
                Copier
              </Button>
            </span>
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="contour" iconLeft={Download04Icon}>
              Télécharger le PDF
            </Button>
            <Button variant="contour" iconLeft={Mail01Icon}>
              Envoyer par e-mail
            </Button>
          </div>
        </div>
      </Dialog>
      <Dialog
        {...props("live")}
        icon={Calendar03Icon}
        iconTone="reussite"
        title="Vous êtes inscrite à la session"
        description="Excel avancé : analyse de données, samedi 24 octobre à 15 h 00, sur Google Meet. Un rappel vous sera envoyé la veille."
        footer={
          <>
            <Button variant="contour" iconLeft={Calendar03Icon}>
              Ajouter à mon agenda
            </Button>
            {bouton("Fermer")}
          </>
        }
      />
    </div>
  );
}
