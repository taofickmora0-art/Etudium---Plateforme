import { Panel, Section } from "../Section";
import { ActionsDemo, BarreDuHautDemo, ListesDemo } from "./MenusDemo";

export function Menus() {
  return (
    <Section id="menus" title="Menus déroulants" description="Surface blanche, rayon 18, ombre portée. Chaque ligne fait au moins 44 px.">
      <Panel title="Menus de la barre du haut">
        <BarreDuHautDemo />
      </Panel>
      <Panel title="Menus d’actions" coque>
        <ActionsDemo />
      </Panel>
      <Panel title="Liste de choix ouverte">
        <ListesDemo />
      </Panel>
    </Section>
  );
}
