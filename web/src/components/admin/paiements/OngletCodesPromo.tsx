"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ChampDate } from "@/components/ui/ChampDate";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { TextInput } from "@/components/ui/TextInput";
import { enregistrerCodePromo } from "@/lib/admin/paiements/actions";
import type { CodePromo } from "@/lib/admin/paiements/types";
import { dureeAbonnement, montantFcfa } from "@/lib/abonnement/regles";
import type { Formule } from "@/lib/abonnement/types";
import { chiffresSeulement } from "./saisie";
import { dateNumerique } from "@/lib/utilisateurs/regles";

const COLONNES = ["Code", "Remise", "Validité", "Utilisations", "État"];
// Avec la 0073 : les abonnements où vaut chaque code, après la remise.
const COLONNES_PAR_ABONNEMENT = ["Code", "Remise", "Abonnements", "Validité", "Utilisations", "État"];
const MIGRATION_0073 = "Appliquez la migration 0073 (guide « Ce qui te revient », section 72).";
const AU_MOINS_UN = "Choisissez au moins un abonnement.";
const ERREUR_ABONNEMENTS = "code-promo-abonnements-erreur";
const TYPES = [
  { value: "pourcentage", label: "Pourcentage" },
  { value: "montant", label: "Montant" },
];

type Saisie = {
  id: string | null;
  code: string;
  type: "pourcentage" | "montant";
  valeur: string;
  debut: string;
  fin: string;
  limite: string;
  actif: boolean;
  /** Les abonnements cochés (identifiants des formules). */
  formules: string[];
};
// Un nouveau code n'a aucun abonnement coché : l'équipe choisit (demande du 3 novembre 2026).
const VIDE: Saisie = { id: null, code: "", type: "pourcentage", valeur: "", debut: "", fin: "", limite: "", actif: true, formules: [] };

/** « 2026-11-30 », le jour au Bénin d'une date enregistrée (UTC+1 fixe). */
const jour = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 3_600_000).toISOString().slice(0, 10) : "");

const versSaisie = (c: CodePromo): Saisie => ({
  id: c.id,
  code: c.code,
  type: c.type,
  valeur: String(c.valeur),
  debut: jour(c.debut),
  fin: jour(c.fin),
  limite: c.limite === null ? "" : String(c.limite),
  actif: c.actif,
  formules: c.formules.map((f) => f.id),
});

/** Ce qui part à l'enregistrement : sans la 0073, l'appel d'avant, sans les abonnements. */
const envoi = ({ formules, ...reste }: Saisie, parAbonnement: boolean) => (parAbonnement ? { ...reste, formules } : reste);

/** « Basique, Premium », ou « Tous » quand le code vaut pour tous les abonnements. */
export function abonnementsDuCode(c: Pick<CodePromo, "formules">, formules: Pick<Formule, "id">[]): string {
  if (c.formules.length === 0) return "—";
  if (formules.length > 0 && formules.every((f) => c.formules.some((x) => x.id === f.id))) return "Tous";
  return c.formules.map((f) => f.nom).join(", ");
}

export const remise = (c: Pick<CodePromo, "type" | "valeur">) => (c.type === "pourcentage" ? `${c.valeur} %` : montantFcfa(c.valeur));

export function validite(c: Pick<CodePromo, "debut" | "fin">): string {
  if (c.debut && c.fin) return `Du ${dateNumerique(c.debut)} au ${dateNumerique(c.fin)}`;
  if (c.debut) return `Dès le ${dateNumerique(c.debut)}`;
  if (c.fin) return `Jusqu’au ${dateNumerique(c.fin)}`;
  return "Sans date";
}

export function etatCode(c: CodePromo, maintenant = Date.now()): { libelle: string; ton: TagTone } {
  if (!c.actif) return { libelle: "Inactif", ton: "enAttente" };
  if (c.fin && Date.parse(c.fin) <= maintenant) return { libelle: "Expiré", ton: "echoue" };
  if (c.limite !== null && c.utilisations >= c.limite) return { libelle: "Épuisé", ton: "enAttente" };
  return { libelle: "Actif", ton: "reussi" };
}

type PropsAbonnements = { formules: Formule[]; cochees: string[]; erreur: string | null; onChange: (ids: string[]) => void };

/** La rubrique « Abonnements concernés » : une case par abonnement, au moins une cochée pour enregistrer (0073). */
function AbonnementsConcernes({ formules, cochees, erreur, onChange }: PropsAbonnements) {
  // Les cochées suivent l'ordre des abonnements, quel que soit l'ordre des clics.
  const cocher = (id: string, coche: boolean) => onChange(formules.map((f) => f.id).filter((x) => (x === id ? coche : cochees.includes(x))));
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" aria-describedby={erreur ? ERREUR_ABONNEMENTS : undefined}>
      <legend className="mb-3 p-0 text-sm leading-5 font-medium text-encre">Abonnements concernés</legend>
      {formules.length === 0 ? (
        <p className="m-0 text-[13px] leading-5 text-discret">Aucun abonnement pour le moment.</p>
      ) : (
        formules.map((f) => (
          <Checkbox
            key={f.id}
            checked={cochees.includes(f.id)}
            onChange={(e) => cocher(f.id, e.target.checked)}
            label={
              <>
                <span className="font-medium text-encre">{f.nom}</span>{" "}
                <span className="text-discret">{`· ${dureeAbonnement(f.dureeMois)}${f.active ? "" : " · non proposé"}`}</span>
              </>
            }
          />
        ))
      )}
      {erreur && (
        <p id={ERREUR_ABONNEMENTS} role="alert" className="m-0 flex items-center gap-1.5 text-xs leading-[18px] text-erreur-texte">
          <Icon icon={AlertCircleIcon} size={14} />
          {erreur}
        </p>
      )}
    </fieldset>
  );
}

type PropsFenetre = { initiale: Saisie; formules: Formule[]; parAbonnement: boolean; onFermer: () => void };

/** Créer ou modifier un code (administrateurs). */
function FenetreCode({ initiale, formules, parAbonnement, onFermer }: PropsFenetre) {
  const router = useRouter();
  const [s, setS] = useState(initiale);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurAbonnements, setErreurAbonnements] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const changer = (champs: Partial<Saisie>) => setS((avant) => ({ ...avant, ...champs }));

  async function enregistrer() {
    if (parAbonnement && s.formules.length === 0) return setErreurAbonnements(AU_MOINS_UN);
    setOccupe(true);
    const r = await enregistrerCodePromo(envoi(s, parAbonnement));
    setOccupe(false);
    if (!r.ok) return setErreur(r.message);
    onFermer();
    router.refresh();
  }

  return (
    <Dialog
      open
      onOpenChange={(ouverte) => !ouverte && onFermer()}
      title={s.id ? `Modifier le code ${initiale.code}` : "Nouveau code promo"}
      description="Une seule utilisation par compte ; seuls les paiements réussis comptent. Après remise, il reste au moins 1 000 FCFA, sauf à 100 % (abonnement offert)."
      className="sm:max-w-[520px]"
      footer={
        <>
          <Button variant="contour" onClick={onFermer}>
            Annuler
          </Button>
          <Button loading={occupe} onClick={() => void enregistrer()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        {erreur && <Banner tone="erreur" title={erreur} />}
        <Field label="Code" htmlFor="code-promo-saisie" hint="3 à 30 lettres, chiffres, tirets ou soulignés.">
          <TextInput id="code-promo-saisie" autoCapitalize="characters" value={s.code} onChange={(e) => changer({ code: e.target.value })} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-sm leading-5 font-medium text-encre">Type de remise</p>
          <FilterChips label="Type de remise" options={TYPES} value={s.type} onValueChange={(v) => changer({ type: v === "montant" ? "montant" : "pourcentage" })} />
        </div>
        <Field label={s.type === "pourcentage" ? "Valeur (%)" : "Valeur (FCFA)"} htmlFor="code-promo-valeur">
          <TextInput id="code-promo-valeur" inputMode="numeric" value={s.valeur} onChange={(e) => changer({ valeur: chiffresSeulement(e.target.value) })} />
        </Field>
        {parAbonnement ? (
          <AbonnementsConcernes
            formules={formules}
            cochees={s.formules}
            erreur={erreurAbonnements}
            onChange={(ids) => {
              changer({ formules: ids });
              if (ids.length > 0) setErreurAbonnements(null);
            }}
          />
        ) : (
          <Banner tone="attention" title={MIGRATION_0073}>
            Le code vaudra pour tous les abonnements.
          </Banner>
        )}
        <div className="flex flex-wrap gap-3.5">
          <Field label="Début (facultatif)" htmlFor="code-promo-debut" className="min-w-[150px] flex-1">
            <ChampDate id="code-promo-debut" value={s.debut} onChange={(iso) => changer({ debut: iso })} />
          </Field>
          <Field label="Fin (facultatif)" htmlFor="code-promo-fin" className="min-w-[150px] flex-1">
            <ChampDate id="code-promo-fin" value={s.fin} onChange={(iso) => changer({ fin: iso })} min={s.debut || undefined} />
          </Field>
        </div>
        <Field label="Limite d’utilisations (facultatif)" htmlFor="code-promo-limite" hint="Vide : sans limite.">
          <TextInput id="code-promo-limite" inputMode="numeric" placeholder="Sans limite" value={s.limite} onChange={(e) => changer({ limite: chiffresSeulement(e.target.value) })} />
        </Field>
        <Switch label="Actif" checked={s.actif} onCheckedChange={(actif) => changer({ actif })} />
      </div>
    </Dialog>
  );
}

type Props = {
  codes: CodePromo[];
  /** Les abonnements (formules), pour les cases de la fenêtre d'un code et la colonne « Abonnements ». */
  formules?: Formule[];
  /** La migration 0073 est appliquée : chaque code vaut pour les abonnements choisis. Sinon, le formulaire d'avant. */
  parAbonnement?: boolean;
  ecriture: boolean;
};

/** L'onglet « Codes promo » : la liste, et pour les administrateurs, créer, modifier, activer ou désactiver. */
export function OngletCodesPromo({ codes, formules = [], parAbonnement = false, ecriture }: Props) {
  const router = useRouter();
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function basculer(c: CodePromo) {
    const r = await enregistrerCodePromo(envoi({ ...versSaisie(c), actif: !c.actif }, parAbonnement));
    if (r.ok) router.refresh();
    else setErreur(r.message);
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {ecriture && (
        <div className="flex justify-end">
          <Button onClick={() => setSaisie(VIDE)}>Nouveau code</Button>
        </div>
      )}
      {erreur && <Banner tone="erreur" title={erreur} />}
      {codes.length === 0 ? (
        <p className="m-0 text-sm leading-[22px] text-discret">Aucun code promo pour le moment.</p>
      ) : (
        <TableauListe
          nom="Codes promo"
          nomCadre="Tableau des codes promo"
          colonnes={parAbonnement ? COLONNES_PAR_ABONNEMENT : COLONNES}
          actions={ecriture}
          largeurMin={parAbonnement ? 900 : 760}
        >
          {codes.map((c) => {
            const etat = etatCode(c);
            return (
              <tr key={c.id}>
                <td className={`${CELLULE_TABLEAU} font-medium whitespace-nowrap text-encre`}>{c.code}</td>
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{remise(c)}</td>
                {parAbonnement && <td className={CELLULE_TABLEAU}>{abonnementsDuCode(c, formules)}</td>}
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{validite(c)}</td>
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{c.limite === null ? String(c.utilisations) : `${c.utilisations} / ${c.limite}`}</td>
                <td className={CELLULE_TABLEAU}>
                  <Tag tone={etat.ton}>{etat.libelle}</Tag>
                </td>
                {ecriture && (
                  <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>
                    <Button variant="discret" size="sm" onClick={() => setSaisie(versSaisie(c))}>
                      Modifier
                    </Button>
                    <Button variant="discret" size="sm" onClick={() => void basculer(c)}>
                      {c.actif ? "Désactiver" : "Activer"}
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </TableauListe>
      )}
      {saisie && <FenetreCode initiale={saisie} formules={formules} parAbonnement={parAbonnement} onFermer={() => setSaisie(null)} />}
    </div>
  );
}
