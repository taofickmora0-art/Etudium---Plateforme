"use client";

import { useState, type ReactNode } from "react";
import {
  BookOpen01Icon,
  CourseIcon,
  Delete02Icon,
  FavouriteIcon,
  Flag01Icon,
  Link01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  PlayCircleIcon,
  Route01Icon,
  Share08Icon,
  SmartPhone01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { FilterMenu } from "@/components/ui/FilterMenu";
import { IconButton } from "@/components/ui/IconButton";
import { Menu } from "@/components/ui/Menu";
import { NotificationsPanel, type AppNotification } from "@/components/ui/NotificationsPanel";
import { ProfileMenu } from "@/components/ui/ProfileMenu";
import { SearchSuggestions } from "@/components/ui/SearchSuggestions";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { SortMenu } from "@/components/ui/SortMenu";

function Exemple({ legende, children }: { legende: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-start">
      {children}
      <span className="mt-2 text-xs leading-[18px] text-ardoise">{legende}</span>
    </div>
  );
}

const NOTIFICATIONS: AppNotification[] = [
  { id: "1", tone: "reussite", title: "Exercice validé", body: "Votre tableau croisé dynamique a été validé par Dr Adjovi.", when: "Il y a 2 h", unread: true, href: "#" },
  { id: "2", tone: "information", icon: Video01Icon, title: "Session live samedi", body: "Excel avancé : analyse de données, samedi à 15 h 00.", when: "Il y a 5 h", unread: true, href: "#" },
  { id: "3", tone: "attention", title: "Abonnement bientôt expiré", body: "Votre formule Standard expire dans 5 jours.", when: "Hier", unread: true, href: "#" },
  { id: "4", tone: "neutre", title: "Nouvelle réponse", body: "Koffi a répondu à votre publication dans l’espace Académique.", when: "Hier", unread: true, href: "#" },
];

export function BarreDuHautDemo() {
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [recherche, setRecherche] = useState("");
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <Exemple legende="Menu du profil (cliquez le rond)">
        <ProfileMenu
          user={{ initials: "AK", name: "Aïcha Kpadé", email: "aicha.k@exemple.com" }}
          roles={["etudiant", "formateur", "admin"]}
          onSignOut={() => {}}
        />
      </Exemple>
      <Exemple legende="Notifications (cliquez la cloche)">
        <NotificationsPanel
          notifications={notifications}
          onMarkAllRead={() => setNotifications((list) => list.map((n) => ({ ...n, unread: false })))}
        />
      </Exemple>
      <Exemple legende="Suggestions de recherche">
        <SearchSuggestions
          query={recherche}
          onQueryChange={setRecherche}
          resultsHref={(q) => `#recherche-${encodeURIComponent(q)}`}
          groups={[
            {
              title: "Formations",
              icon: CourseIcon,
              items: [
                { label: "Maîtriser Microsoft Excel", meta: "Académique · 68 % terminé", href: "#excel" },
                { label: "Zotero : gérer ses références", meta: "Académique · terminée", href: "#zotero" },
              ],
            },
            { title: "Parcours", icon: Route01Icon, items: [{ label: "Réussite académique", href: "#reussite" }] },
          ]}
        />
      </Exemple>
    </div>
  );
}

const PLUS = <IconButton icon={MoreHorizontalIcon} label="Plus d’actions" />;

export function ActionsDemo() {
  const [tri, setTri] = useState("recentes");
  const [filtres, setFiltres] = useState(["academique", "digital"]);
  return (
    <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <Exemple legende="Carte de formation">
        <Menu
          label="Actions de la formation"
          align="start"
          className="w-[250px]"
          trigger={PLUS}
          items={[
            { label: "Continuer la formation", icon: PlayCircleIcon },
            { label: "Ajouter aux favoris", icon: FavouriteIcon },
            { label: "Voir la fiche", icon: BookOpen01Icon },
            { label: "Partager", icon: Share08Icon },
          ]}
        />
      </Exemple>
      <Exemple legende="Publication, avec action dangereuse">
        <Menu
          label="Actions de la publication"
          align="start"
          trigger={PLUS}
          items={[
            { label: "Modifier", icon: PencilEdit02Icon },
            { label: "Copier le lien", icon: Link01Icon },
            { label: "Signaler", icon: Flag01Icon },
            { separator: true },
            { label: "Supprimer", icon: Delete02Icon, danger: true },
          ]}
        />
      </Exemple>
      <Exemple legende="Tri, option cochée">
        <SortMenu
          value={tri}
          onValueChange={setTri}
          options={[
            { value: "recentes", label: "Les plus récentes" },
            { value: "progression", label: "Progression" },
            { value: "duree", label: "Durée" },
            { value: "note", label: "Note des étudiants" },
          ]}
        />
      </Exemple>
      <Exemple legende="Filtre à cases">
        <FilterMenu
          title="Parcours"
          values={filtres}
          onApply={setFiltres}
          options={[
            { value: "academique", label: "Académique" },
            { value: "digital", label: "Digital" },
            { value: "business", label: "Business" },
          ]}
        />
      </Exemple>
    </div>
  );
}

export function ListesDemo() {
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <SelectMenu
        label="Niveau d’études"
        defaultValue="m1"
        options={[
          { value: "l3", label: "Licence 3" },
          { value: "m1", label: "Master 1" },
          { value: "m2", label: "Master 2" },
          { value: "diplome", label: "Jeune diplômé(e)" },
        ]}
      />
      <SelectMenu
        label="Opérateur Mobile Money"
        defaultValue="mtn"
        options={[
          { value: "mtn", label: "MTN Mobile Money", icon: SmartPhone01Icon },
          { value: "moov", label: "Moov Money", icon: SmartPhone01Icon },
          { value: "celtiis", label: "Celtiis Cash", icon: SmartPhone01Icon },
        ]}
      />
      <div className="flex flex-col gap-2">
        <SelectMenu
          label="Espace de la communauté"
          defaultValue="academique"
          options={[
            { value: "academique", label: "Espace Académique" },
            { value: "digital", label: "Espace Digital" },
            { value: "business", label: "Espace Business" },
          ]}
        />
        <p className="m-0 text-xs leading-[18px] text-ardoise">Fermée : même champ que les autres, flèche vers le bas.</p>
      </div>
    </div>
  );
}
