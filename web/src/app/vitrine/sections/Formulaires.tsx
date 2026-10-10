import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { Panel, Section } from "../Section";
import { CodeDemo, DepotDemo, FormulesDemo } from "./FormulairesDemo";

function Grille({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

const PAYS = ["Bénin", "Togo", "Côte d’Ivoire", "Sénégal"].map((p) => ({ value: p, label: p }));

export function Formulaires() {
  return (
    <Section
      id="formulaires"
      title="Formulaires"
      description="Champs de 48 px, libellé toujours visible au-dessus, message d’aide ou d’erreur en dessous."
    >
      <Panel title="Champs de texte">
        <Grille>
          <Field label="Adresse e-mail" htmlFor="v-email-vide">
            <TextInput id="v-email-vide" type="email" placeholder="vous@exemple.com" />
          </Field>
          <Field label="Adresse e-mail" htmlFor="v-email">
            <TextInput id="v-email" type="email" defaultValue="aicha.k@exemple.com" />
          </Field>
          <Field label="Numéro Mobile Money" htmlFor="v-momo" error="Entrez un numéro à 10 chiffres.">
            <TextInput id="v-momo" inputMode="tel" defaultValue="01 97 00" />
          </Field>
          <Field label="Mot de passe" htmlFor="v-mdp" hint="Au moins 8 caractères.">
            <PasswordInput id="v-mdp" defaultValue="motdepasse" />
          </Field>
          <Field label="Rechercher" htmlFor="v-recherche">
            <SearchInput id="v-recherche" placeholder="Une formation, un parcours, une ressource…" />
          </Field>
          <Field label="Établissement" htmlFor="v-etab" hint="Modifiable par l’administration uniquement.">
            <TextInput id="v-etab" defaultValue="Université d’Abomey-Calavi" disabled />
          </Field>
        </Grille>
      </Panel>

      <Panel title="Listes, zones de texte et code">
        <Grille>
          <Field label="Pays" htmlFor="v-pays">
            <Select id="v-pays" options={PAYS} defaultValue="Bénin" />
          </Field>
          <Field label="Objectifs d’apprentissage" htmlFor="v-objectifs">
            <Textarea
              id="v-objectifs"
              defaultValue="Terminer mon mémoire avant juin et trouver un stage en communication digitale."
            />
          </Field>
          <CodeDemo />
        </Grille>
      </Panel>

      <Panel title="Cases, boutons radio et interrupteurs">
        <Grille>
          <div className="flex min-w-0 flex-col gap-3">
            <Checkbox label="Se souvenir de moi sur cet appareil" defaultChecked />
            <Checkbox label="J’accepte les conditions d’utilisation" />
            <Checkbox label="Recevoir les nouveautés par e-mail" />
          </div>
          <RadioGroup
            label="Opérateur Mobile Money"
            name="v-operateur"
            defaultValue="mtn"
            options={[
              { value: "mtn", label: "MTN Mobile Money" },
              { value: "moov", label: "Moov Money" },
              { value: "celtiis", label: "Celtiis Cash" },
            ]}
          />
          <div className="flex min-w-0 flex-col gap-4">
            <Switch label="Rappels de session live" defaultChecked />
            <Switch label="Nouveautés du catalogue" />
          </div>
        </Grille>
      </Panel>

      <Panel title="Choix en cartes">
        <FormulesDemo />
      </Panel>

      <Panel title="Dépôt de fichier">
        <DepotDemo />
      </Panel>
    </Section>
  );
}
