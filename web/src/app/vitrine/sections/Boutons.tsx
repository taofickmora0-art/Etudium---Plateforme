import type { ReactNode } from "react";
import {
  ArrowRight02Icon,
  Cancel01Icon,
  Download04Icon,
  FavouriteIcon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { Avatar, AvatarGroup } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { ProgressBar, ProgressMeta } from "@/components/ui/Progress";
import { Tag } from "@/components/ui/Tag";
import {
  ActionButton,
  CounterPill,
  LogoButton,
  NotificationButton,
  ProfileButton,
  SearchButton,
} from "@/components/ui/TopBarButtons";
import { Panel, Section } from "../Section";
import { FiltresDemo } from "./FiltresDemo";

/** Un exemple et sa légende en dessous, comme sur la planche. */
function Exemple({ legende, children }: { legende: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-start">
      {children}
      <span className="mt-2 block text-xs leading-[18px] text-ardoise">{legende}</span>
    </div>
  );
}

function Rangee({ gap = "gap-6", children }: { gap?: string; children: ReactNode }) {
  return <div className={`flex flex-wrap items-end ${gap}`}>{children}</div>;
}

const PROGRESSIONS = [
  { value: 68, time: "2 h restantes", legende: "En cours" },
  { value: 100, time: "4 h 10 suivies", legende: "Terminée" },
  { value: 0, time: "7 h 45 restantes", legende: "À commencer" },
];

export function Boutons() {
  return (
    <Section
      id="boutons"
      title="Boutons, filtres et étiquettes"
      description="Un seul bouton principal, en bleu Étudium, par écran. Le rouge est réservé aux actions irréversibles."
    >
      <Panel title="Boutons · variantes">
        <div className="grid grid-cols-1 items-start gap-6 min-[440px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          <Exemple legende="Principal">
            <Button>Reprendre la leçon</Button>
          </Exemple>
          <Exemple legende="Gris">
            <Button variant="gris">Ajouter une formation</Button>
          </Exemple>
          <Exemple legende="Contour">
            <Button variant="contour">Annuler</Button>
          </Exemple>
          <Exemple legende="Discret">
            <Button variant="discret">Voir le parcours</Button>
          </Exemple>
          <Exemple legende="Danger">
            <Button variant="danger">Supprimer</Button>
          </Exemple>
          <Exemple legende="Danger doux">
            <Button variant="dangerDoux">Supprimer mon compte</Button>
          </Exemple>
        </div>
      </Panel>

      <Panel title="Tailles et icônes">
        <Rangee>
          <Exemple legende="Grand · 48 px">
            <Button size="lg">Créer un compte gratuit</Button>
          </Exemple>
          <Exemple legende="Moyen · 42 px">
            <Button iconRight={ArrowRight02Icon}>Continuer</Button>
          </Exemple>
          <Exemple legende="Petit · 34 px">
            <Button size="sm" variant="gris">
              Appliquer
            </Button>
          </Exemple>
          <Exemple legende="Icône à gauche">
            <Button variant="contour" iconLeft={Download04Icon}>
              Télécharger le reçu
            </Button>
          </Exemple>
          <Exemple legende="Désactivé">
            <Button disabled>Enregistrer</Button>
          </Exemple>
          <Exemple legende="Chargement">
            <Button loading>Paiement en cours…</Button>
          </Exemple>
          <Exemple legende="Icône seule">
            <IconButton icon={MoreHorizontalIcon} label="Plus d’actions" />
          </Exemple>
          <Exemple legende="Icône, contour">
            <IconButton icon={FavouriteIcon} label="Ajouter aux favoris" variant="contour" />
          </Exemple>
          <Exemple legende="Fermer">
            <IconButton icon={Cancel01Icon} label="Fermer" variant="discret" size="sm" />
          </Exemple>
        </Rangee>
      </Panel>

      <Panel title="Boutons de la barre du haut">
        <Rangee>
          <Exemple legende="Logo">
            <LogoButton href="/vitrine" />
          </Exemple>
          <Exemple legende="Recherche">
            <SearchButton />
          </Exemple>
          <Exemple legende="Action">
            <ActionButton>Ajouter une formation</ActionButton>
          </Exemple>
          <Exemple legende="Série de jours">
            <CounterPill icon="serie" value={8} label="Série de jours" />
          </Exemple>
          <Exemple legende="Points">
            <CounterPill icon="points" value={165} label="Points" />
          </Exemple>
          <Exemple legende="Notifications">
            <NotificationButton />
          </Exemple>
          <Exemple legende="Profil">
            <ProfileButton />
          </Exemple>
        </Rangee>
      </Panel>

      <Panel title="Filtres et onglets">
        <FiltresDemo />
      </Panel>

      <Panel title="Étiquettes">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="nouveau">Nouveau</Tag>
            <Tag tone="gratuit">Gratuit</Tag>
            <Tag tone="populaire">Populaire</Tag>
            <Tag tone="complementaire">Complémentaire</Tag>
            <Tag tone="verrouillee">Verrouillée</Tag>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="valide">Validé</Tag>
            <Tag tone="aCorriger">À corriger</Tag>
            <Tag tone="enAttente">En attente</Tag>
            <Tag tone="echoue">Échoué</Tag>
            <Tag tone="reussi">Réussi</Tag>
            <Tag tone="compteur">1 à corriger</Tag>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="academique">Académique</Tag>
            <Tag tone="digital">Digital</Tag>
            <Tag tone="business">Business</Tag>
          </div>
        </div>
      </Panel>

      <Panel title="Avatars et progression">
        <Rangee gap="gap-7">
          <Exemple legende="52 px">
            <Avatar initials="AK" size={52} />
          </Exemple>
          <Exemple legende="40 px">
            <Avatar initials="AK" size={40} />
          </Exemple>
          <Exemple legende="32 px">
            <Avatar initials="KD" size={32} />
          </Exemple>
          <Exemple legende="Groupe">
            <AvatarGroup>
              <Avatar initials="RH" size={32} tone="violet" />
              <Avatar initials="FA" size={32} />
              <Avatar initials="SD" size={32} tone="ambre" />
            </AvatarGroup>
          </Exemple>
          {PROGRESSIONS.map((p) => (
            <Exemple key={p.legende} legende={p.legende}>
              <div className="w-[272px] max-w-full">
                <ProgressBar value={p.value} />
                <ProgressMeta value={p.value} timeLabel={p.time} className="mt-2" />
              </div>
            </Exemple>
          ))}
        </Rangee>
      </Panel>
    </Section>
  );
}
