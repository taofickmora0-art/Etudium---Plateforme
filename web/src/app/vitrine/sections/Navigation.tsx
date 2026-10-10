import {
  AssignmentsIcon,
  BubbleChatIcon,
  Calendar03Icon,
  Certificate01Icon,
  CourseIcon,
  Home03Icon,
  UserGroupIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { Accordion } from "@/components/ui/Accordion";
import { BottomBar } from "@/components/ui/BottomBar";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { SidebarGroup } from "@/components/ui/SidebarGroup";
import { SidebarItem } from "@/components/ui/SidebarItem";
import { Stepper } from "@/components/ui/Stepper";
import { Panel, Section } from "../Section";
import { PagesDemo } from "./NavigationDemo";

const ONGLETS = ["Programme", "Ressources", "Questions", "Notes"].map((label) => ({
  value: label.toLowerCase(),
  label,
  content: <p className="m-0 text-sm text-discret">Contenu de l’onglet « {label} ».</p>,
}));

const NOTES = [
  "Entrée de 48 px, rayon 14, icône 20 px et libellé 16 px.",
  "L’entrée active est une pastille blanche, texte et icône en bleu Étudium ; le survol l’annonce en blanc translucide.",
  "Les intertitres en capitales séparent les groupes, suivis d’un filet.",
];

export function Navigation() {
  return (
    <Section id="navigation" title="Navigation" description="Barre du haut, barre latérale et repères de parcours dans une page.">
      <Panel title="Barre latérale · au repos, active, avec étiquette" coque>
        <div className="flex flex-wrap gap-6">
          <nav aria-label="Navigation principale" className="flex w-full max-w-[337px] flex-col gap-3">
            <SidebarGroup>
              <SidebarItem href="#" icon={Home03Icon} label="Accueil" />
              <SidebarItem href="#" icon={Calendar03Icon} label="Événements" tag="Nouveau" />
              <SidebarItem href="#" icon={UserGroupIcon} label="Communauté" />
              <SidebarItem href="#" icon={BubbleChatIcon} label="Messages" />
            </SidebarGroup>
            <SidebarGroup title="Mon espace">
              <SidebarItem href="#" icon={CourseIcon} label="Mes formations" active />
              <SidebarItem href="#" icon={AssignmentsIcon} label="Exercices" tag="1 à corriger" />
            </SidebarGroup>
          </nav>
          <div className="flex min-w-[280px] flex-1 flex-col justify-center gap-3.5">
            {NOTES.map((note) => (
              <p key={note} className="m-0 text-sm leading-[22px] text-pretty text-ardoise">
                {note}
              </p>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Fil d’Ariane, étapes et onglets">
        <div className="flex min-w-0 flex-col gap-[22px]">
          <Breadcrumb
            items={[{ label: "Mes formations", href: "#" }, { label: "Maîtriser Microsoft Excel", href: "#" }, { label: "Module 3" }]}
          />
          <Stepper label="Étapes de l’abonnement" steps={["Formule", "Parcours", "Paiement", "Confirmation"]} current={2} />
          <SegmentedTabs label="Sections de la formation" items={ONGLETS} className="gap-3" />
          <PagesDemo />
        </div>
      </Panel>

      <Panel title="Questions dépliables">
        <Accordion
          defaultOpen={[0]}
          items={[
            {
              question: "Puis-je changer de formule en cours de mois ?",
              answer:
                "Oui. Passer à une formule supérieure est immédiat : vous ne payez que la différence au prorata. Une formule inférieure s’applique au prochain renouvellement.",
            },
            {
              question: "Mes certificats restent-ils valables si mon abonnement expire ?",
              answer: "Oui. Vos certificats et leur QR Code de vérification restent sur votre compte.",
            },
          ]}
        />
      </Panel>

      <Panel title="Barre du bas · téléphone">
        <div className="w-[374px] max-w-full">
          <BottomBar
            items={[
              { href: "#accueil", icon: Home03Icon, label: "Accueil", active: true },
              { href: "#formations", icon: CourseIcon, label: "Formations" },
              { href: "#communaute", icon: UserGroupIcon, label: "Communauté" },
              { href: "#certificats", icon: Certificate01Icon, label: "Certificats" },
              { href: "#profil", icon: UserIcon, label: "Profil" },
            ]}
          />
        </div>
      </Panel>
    </Section>
  );
}
