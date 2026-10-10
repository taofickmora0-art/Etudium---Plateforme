import type { ReactNode } from "react";
import { CourseIllustration } from "@/components/ui/CourseIllustration";
import { Icon } from "@/components/ui/Icon";
import { Description, Eyebrow, Heading, Lead } from "@/components/ui/Text";
import { Panel, Section } from "../Section";
import { ICONES_DU_DESIGN } from "./icones";

const SURFACES = [
  ["bg-page border-bordure-carte", "Fond de page", "#F2F6FD · derrière tout"],
  ["bg-coque border-bordure-carte", "Coque", "#E9EFFB · barre latérale, boutons gris"],
  ["bg-panneau border-bordure-carte", "Panneau", "#FFFFFF · contenu, cartes"],
  ["bg-encre border-transparent", "Encre forte", "#1D1D1F · titres, notifications éphémères"],
  ["bg-texte border-transparent", "Texte", "#232326 · texte courant"],
  ["bg-discret border-transparent", "Texte discret", "#667085 · descriptions, métadonnées"],
] as const;

const ETATS = [
  ["bg-bleu-pale text-bleu", "Information", "#DDE1FF · #0B18C9"],
  ["bg-reussite-fond text-reussite-texte", "Réussite", "#DDF3E4 · #17663A"],
  ["bg-attention-fond text-attention-texte", "Attention", "#FBEFD0 · #8A5A00"],
  ["bg-erreur-fond text-erreur-texte", "Erreur, danger", "#FBE3E1 · #B42318"],
  ["bg-premium-fond text-premium-texte", "Digital, premium", "#EDE9FE · #6D28D9"],
] as const;

const RAYONS = [
  ["rounded-etiquette", "4 px · étiquettes"],
  ["rounded-champ", "12 px · filtres, champs"],
  ["rounded-bouton", "14 px · boutons, navigation"],
  ["rounded-carte", "16 px · cartes"],
  ["rounded-panneau", "28 px · panneau"],
  ["rounded-coque", "32 px · coque"],
] as const;

function Nuance({ swatch, name, value, children }: { swatch: string; name: string; value: string; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className={`flex h-[72px] items-center justify-center rounded-carte border text-sm font-semibold ${swatch}`}>{children}</span>
      <span className="text-sm leading-5 font-semibold text-encre">{name}</span>
      <span className="text-xs leading-[18px] text-discret">{value}</span>
    </div>
  );
}

function LigneTypo({ legende, children }: { legende: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-bordure-carte py-3.5">
      <div className="min-w-0">{children}</div>
      <span className="text-xs leading-[18px] whitespace-nowrap text-discret">{legende}</span>
    </div>
  );
}

export function Fondations() {
  return (
    <Section
      id="fondations"
      title="Fondations"
      description="Formes, typographie, rayons et icônes repris du dashboard de référence, avec le bleu Étudium comme couleur d’action et une couleur par parcours."
    >
      <Panel title="Surfaces et texte">
        <div className="grid grid-cols-2 items-start gap-6 md:grid-cols-3 xl:grid-cols-6">
          {SURFACES.map(([swatch, name, value]) => (
            <Nuance key={name} swatch={swatch} name={name} value={value} />
          ))}
        </div>
      </Panel>

      <Panel title="Accent et états">
        <div className="grid grid-cols-2 items-start gap-6 md:grid-cols-3 xl:grid-cols-6">
          <Nuance swatch="bg-bleu border-transparent" name="Bleu Étudium" value="#0B18C9 · boutons, liens, progression, sélection" />
          {ETATS.map(([swatch, name, value]) => (
            <Nuance key={name} swatch={`${swatch} border-transparent`} name={name} value={value}>
              Aa
            </Nuance>
          ))}
        </div>
      </Panel>

      <Panel title="Typographie · Inter">
        <LigneTypo legende="Titre de page · 32 / 40 · 500">
          <Heading level="page" as="p">Mes formations</Heading>
        </LigneTypo>
        <LigneTypo legende="Chapeau · 16 / 24 · 400">
          <Lead>Formations de vos parcours et formations complémentaires achetées.</Lead>
        </LigneTypo>
        <LigneTypo legende="Titre de section · 20 / 28 · 600">
          <Heading level="section" as="p">Continuer l’apprentissage</Heading>
        </LigneTypo>
        <LigneTypo legende="Titre de carte · 16 / 24 · 600">
          <Heading level="card" as="p">Maîtriser Microsoft Excel</Heading>
        </LigneTypo>
        <LigneTypo legende="Texte · 14 / 22 · 400">
          <p className="m-0 text-sm leading-[22px] text-texte">Vous apprenez, vous pratiquez, un formateur vous accompagne.</p>
        </LigneTypo>
        <LigneTypo legende="Description · 12 / 18–20 · 400">
          <Description>Formules, tableaux croisés dynamiques et graphiques.</Description>
        </LigneTypo>
        <LigneTypo legende="Intertitre · 13,5 · capitales">
          <Eyebrow>Mon espace</Eyebrow>
        </LigneTypo>
      </Panel>

      <Panel title="Rayons et illustration">
        <div className="flex flex-wrap items-end gap-7">
          {RAYONS.map(([rayon, legende]) => (
            <div key={rayon} className="flex flex-col gap-2">
              <span className={`block h-[72px] w-24 bg-coque ${rayon}`} />
              <span className="text-xs leading-[18px] text-discret">{legende}</span>
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <span className="flex gap-3">
              <CourseIllustration parcours="academique" size={72} />
              <CourseIllustration parcours="digital" size={72} />
              <CourseIllustration parcours="business" size={72} />
            </span>
            <span className="text-xs leading-[18px] text-discret">Illustration des cartes · Académique, Digital, Business</span>
          </div>
        </div>
      </Panel>

      <Panel title="Icônes · Hugeicons, contour 1,5 px">
        <ul className="m-0 grid list-none grid-cols-4 gap-x-2 gap-y-5 p-0 sm:grid-cols-6 lg:grid-cols-12">
          {ICONES_DU_DESIGN.map(([name, icon]) => (
            <li key={name} className="flex flex-col items-center gap-1.5 text-texte">
              <Icon icon={icon} size={24} />
              <span className="text-center text-[11px] leading-[14px] break-all text-discret">{name}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </Section>
  );
}
