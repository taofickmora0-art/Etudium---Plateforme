import type { ComponentProps, ReactNode } from "react";
import { AssignmentsIcon, Certificate01Icon, FireIcon, Quiz01Icon, Target02Icon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CatalogCard } from "@/components/ui/CatalogCard";
import { CourseCard } from "@/components/ui/CourseCard";
import { IconTile } from "@/components/ui/IconTile";
import { List, ListRow } from "@/components/ui/ListRow";
import { StatCard } from "@/components/ui/StatCard";
import { Tag } from "@/components/ui/Tag";
import { Panel, Section } from "../Section";
import { PaiementsDemo } from "./PaiementsDemo";

function Exemple({ legende, children }: { legende: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      {children}
      <span className="mt-2 text-xs leading-[18px] text-ardoise">{legende}</span>
    </div>
  );
}

const GRILLE = "grid grid-cols-1 items-start gap-5 sm:grid-cols-2 xl:grid-cols-4";

const FORMATIONS: (ComponentProps<typeof CourseCard> & { legende: string })[] = [
  {
    legende: "En cours",
    href: "#",
    title: "Maîtriser Microsoft Excel",
    description: "Formules, tableaux croisés dynamiques et graphiques pour analyser vos données.",
    parcours: "academique",
    progress: 68,
    timeLabel: "2 h restantes",
    state: "enCours",
  },
  {
    legende: "Terminée",
    href: "#",
    title: "Microsoft Word pour vos travaux universitaires",
    description: "Styles, sommaire automatique et mise en page du mémoire, étape par étape.",
    parcours: "academique",
    progress: 100,
    timeLabel: "4 h 10 suivies",
    state: "terminee",
  },
  {
    legende: "À commencer, avec étiquette",
    href: "#",
    title: "Méthodologie du mémoire",
    description: "De la problématique à la rédaction : la méthode pour avancer sans vous perdre.",
    parcours: "academique",
    progress: 0,
    timeLabel: "7 h 45 restantes",
    state: "aCommencer",
    tag: { tone: "populaire", label: "Populaire" },
  },
  {
    legende: "Verrouillée",
    href: "#",
    title: "Marketing digital pour débutants",
    description: "Les bases pour trouver vos premiers clients en ligne : réseaux, contenu, publicité.",
    parcours: "business",
    progress: 35,
    timeLabel: "Accès expiré",
    state: "verrouillee",
  },
];

const TITRE_LONG = "Communication digitale et gestion des réseaux sociaux pour les associations universitaires";

export function Cartes() {
  return (
    <Section
      id="cartes"
      title="Cartes, listes et tableaux"
      description="La carte de formation est le motif central : illustration, titre, deux lignes de description, progression."
    >
      <Panel title="Carte de formation · états">
        <div className={GRILLE}>
          {FORMATIONS.map(({ legende, ...carte }) => (
            <Exemple key={legende} legende={legende}>
              <CourseCard {...carte} />
            </Exemple>
          ))}
          <Exemple legende="Titre de 90 caractères">
            <CourseCard
              href="#"
              title={TITRE_LONG}
              description="Planifier, rédiger et mesurer : une méthode simple pour faire vivre les pages de votre association."
              parcours="digital"
              progress={12}
              timeLabel="5 h 20 restantes"
              state="enCours"
            />
          </Exemple>
        </div>
      </Panel>

      <Panel title="Carte de catalogue et indicateurs">
        <div className={GRILLE}>
          <CatalogCard
            href="#"
            title="Lancer son activité de freelance"
            description="Offre, tarifs, premiers clients : les étapes pour démarrer une activité en ligne."
            parcours="business"
            rating={4.8}
            reviews={69}
            duration="6 h 00"
            level="Intermédiaire"
            tag={{ tone: "populaire", label: "Populaire" }}
          />
          <StatCard icon={Target02Icon} label="Progression globale" value="72 %" hint="+12 % ce mois" />
          <StatCard icon={Certificate01Icon} tone="reussite" label="Certificats obtenus" value="2" hint="Word et Zotero" />
          <StatCard icon={FireIcon} tone="attention" label="Série d’apprentissage" value="8 jours" hint="Continuez comme ça" />
        </div>
      </Panel>

      <Panel title="Liste">
        <List label="Activité récente">
          <ListRow
            href="#"
            leading={<IconTile icon={AssignmentsIcon} size={44} tone="attention" />}
            title="Exercice à corriger"
            subtitle="Excel · Tableau des ventes"
            trailing={<Tag tone="aCorriger">À corriger</Tag>}
          />
          <ListRow href="#" leading={<IconTile icon={Quiz01Icon} size={44} />} title="Quiz du module 3" subtitle="Excel · 4 questions" />
          <ListRow
            leading={<Avatar initials="KD" size={44} />}
            title="Koffi D."
            subtitle="A répondu à votre publication · il y a 2 h"
            trailing={
              <Button variant="contour" size="sm">
                Répondre
              </Button>
            }
          />
        </List>
      </Panel>

      <Panel title="Tableau et pagination">
        <PaiementsDemo />
      </Panel>
    </Section>
  );
}
