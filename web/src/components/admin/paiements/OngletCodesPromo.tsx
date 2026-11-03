"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ChampDate } from "@/components/ui/ChampDate";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Switch } from "@/components/ui/Switch";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { TextInput } from "@/components/ui/TextInput";
import { enregistrerCodePromo } from "@/lib/admin/paiements/actions";
import type { CodePromo } from "@/lib/admin/paiements/types";
import { montantFcfa } from "@/lib/abonnement/regles";
import { chiffresSeulement } from "./saisie";
import { dateNumerique } from "@/lib/utilisateurs/regles";

const COLONNES = ["Code", "Remise", "Validité", "Utilisations", "État"];
const TYPES = [
  { value: "pourcentage", label: "Pourcentage" },
  { value: "montant", label: "Montant" },
];

type Saisie = { id: string | null; code: string; type: "pourcentage" | "montant"; valeur: string; debut: string; fin: string; limite: string; actif: boolean };
const VIDE: Saisie = { id: null, code: "", type: "pourcentage", valeur: "", debut: "", fin: "", limite: "", actif: true };

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
});

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

/** Créer ou modifier un code (administrateurs). */
function FenetreCode({ initiale, onFermer }: { initiale: Saisie; onFermer: () => void }) {
  const router = useRouter();
  const [s, setS] = useState(initiale);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const changer = (champs: Partial<Saisie>) => setS((avant) => ({ ...avant, ...champs }));

  async function enregistrer() {
    setOccupe(true);
    const r = await enregistrerCodePromo(s);
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

/** L'onglet « Codes promo » : la liste, et pour les administrateurs, créer, modifier, activer ou désactiver. */
export function OngletCodesPromo({ codes, ecriture }: { codes: CodePromo[]; ecriture: boolean }) {
  const router = useRouter();
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function basculer(c: CodePromo) {
    const r = await enregistrerCodePromo({ ...versSaisie(c), actif: !c.actif });
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
        <TableauListe nom="Codes promo" nomCadre="Tableau des codes promo" colonnes={COLONNES} actions={ecriture} largeurMin={760}>
          {codes.map((c) => {
            const etat = etatCode(c);
            return (
              <tr key={c.id}>
                <td className={`${CELLULE_TABLEAU} font-medium whitespace-nowrap text-encre`}>{c.code}</td>
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{remise(c)}</td>
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
      {saisie && <FenetreCode initiale={saisie} onFermer={() => setSaisie(null)} />}
    </div>
  );
}
