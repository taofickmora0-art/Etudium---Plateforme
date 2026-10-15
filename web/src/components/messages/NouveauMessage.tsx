"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { chercherContacts, ouvrirConversation } from "@/lib/messages/actions";
import type { Contact, EspaceMessages } from "@/lib/messages/types";
import { AvatarInterlocuteur } from "./AvatarInterlocuteur";

/**
 * « Nouveau message » : à qui écrire. L'étudiant choisit parmi ses formateurs et l'Équipe Étudium ; le formateur
 * cherche un de ses étudiants par son nom. Choisir ouvre (ou retrouve) la conversation.
 */
export function NouveauMessage({
  espace,
  base,
  contactsInitiaux,
  open,
  onOpenChange,
}: {
  espace: EspaceMessages;
  base: string;
  contactsInitiaux: Contact[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  // Le résultat d'une recherche, avec le terme cherché : il ne s'affiche que pour ce terme.
  const [trouves, setTrouves] = useState<{ terme: string; contacts: Contact[] } | null>(null);
  const [ouverture, setOuverture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const formateur = espace === "formateur";

  // Le formateur cherche : une lecture 250 ms après la dernière touche.
  useEffect(() => {
    if (!formateur || !open) return;
    const terme = recherche.trim();
    if (!terme) return;
    const minuterie = setTimeout(() => {
      void chercherContacts(espace, terme).then((contacts) => setTrouves({ terme, contacts }));
    }, 250);
    return () => clearTimeout(minuterie);
  }, [recherche, formateur, open, espace]);

  async function choisir(contact: Contact) {
    const cle = contact.id ?? "equipe";
    setOuverture(cle);
    setErreur(null);
    const reponse = await ouvrirConversation(contact.id).catch(() => ({ ok: false as const, message: "La conversation n’a pas pu s’ouvrir. Réessayez." }));
    setOuverture(null);
    if (!reponse.ok) return setErreur(reponse.message);
    onOpenChange(false);
    router.push(`${base}?c=${reponse.id}`);
  }

  const terme = recherche.trim();
  const contacts = formateur && terme ? (trouves?.terme === terme ? trouves.contacts : []) : contactsInitiaux;
  return (
    <Dialog
      open={open}
      onOpenChange={(ouvert) => {
        onOpenChange(ouvert);
        if (!ouvert) {
          setRecherche("");
          setErreur(null);
        }
      }}
      title="Nouveau message"
      description={formateur ? "Écrivez à un étudiant qui suit une de vos formations." : "Écrivez à un formateur de vos formations, ou à l’équipe Étudium."}
    >
      {formateur && (
        <span className="relative mt-4 block">
          <span className="pointer-events-none absolute top-3.5 left-3.5 text-discret">
            <Icon icon={Search01Icon} size={20} />
          </span>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            aria-label="Rechercher un étudiant"
            placeholder="Rechercher un étudiant…"
            className="box-border h-12 w-full rounded-champ border border-bordure-champ bg-panneau pr-3.5 pl-11 font-[inherit] text-[15px] text-texte placeholder:text-indice focus:border-bleu focus:outline-none"
          />
        </span>
      )}
      {erreur && (
        <p role="alert" className="m-0 mt-3 text-[13px] leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
      <ul className="m-0 mt-4 flex max-h-[50dvh] list-none flex-col gap-1 overflow-y-auto p-0">
        {contacts.length === 0 && (
          <li className="py-6 text-center text-sm leading-[22px] text-discret">
            {formateur
              ? terme
                ? trouves?.terme === terme
                  ? "Aucun étudiant ne correspond."
                  : "Recherche…"
                : "Aucun étudiant ne suit encore vos formations."
              : "Commencez une formation pour écrire à son formateur."}
          </li>
        )}
        {contacts.map((c) => (
          <li key={c.id ?? "equipe"}>
            <button
              type="button"
              disabled={ouverture !== null}
              onClick={() => void choisir(c)}
              className="focus-etudium box-border flex w-full cursor-pointer items-center gap-3 rounded-bouton border-0 bg-transparent px-3 py-2.5 text-left font-[inherit] text-texte transition-colors hover:bg-page disabled:cursor-wait"
            >
              <AvatarInterlocuteur avec={{ nom: c.nom, photoUrl: c.photoUrl, role: c.id === null ? "Assistance" : formateur ? "Étudiant·e" : "Formateur·rice", equipe: c.id === null }} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] leading-[22px] font-semibold text-encre">{c.nom}</span>
                <span className="truncate text-[13px] leading-5 text-discret">{c.id === null ? "Assistance" : c.formation}</span>
              </span>
              {ouverture === (c.id ?? "equipe") && <Spinner size={18} />}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
